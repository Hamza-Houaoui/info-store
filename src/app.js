import { db, initDefaultData } from './db.js';
import { translations } from './translations.js';

class App {
  constructor() {
    this.currentLang = localStorage.getItem('info_store_lang') || 'fr';
    this.activeView = 'dashboard';
    this.cart = [];
    this.settings = {};
    this.currentProductPic = '';
    this.currentBrandLogo = '';
    this.allClients = [];
    
    // Éléments DOM Globaux
    this.langToggleBtn = document.getElementById('lang-toggle-btn');
    this.langLabel = document.getElementById('lang-label');
    this.sidebarLinks = document.querySelectorAll('.sidebar-menu .menu-link');
    this.sections = document.querySelectorAll('.view-section');
    this.pageTitle = document.getElementById('main-page-title');
    this.pageSubtitle = document.getElementById('main-page-subtitle');
    this.sidebarCaisseVal = document.getElementById('sidebar-caisse-val');

    // Initialiser les écouteurs d'événements (une seule fois au chargement)
    this.setupEventListeners();

    // Initialisation
    this.init();
  }

  async init() {
    // 1. Charger les données par défaut de la base
    await initDefaultData();
    
    // 2. Charger les paramètres
    await this.loadSettings();

    // 3. Appliquer la langue
    this.setLanguage(this.currentLang);

    // 4. Mettre à jour l'affichage global (comme le fond de caisse)
    await this.updateSidebarCaisse();

    // 5. Charger la vue initiale
    this.renderActiveView();
  }

  // Moteur de traduction / i18n
  setLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('info_store_lang', lang);
    
    // Déterminer la direction d'écriture (RTL pour Arabe, LTR pour Français)
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;

    // Mettre à jour le bouton de changement de langue
    if (lang === 'ar') {
      this.langLabel.textContent = 'Français';
    } else {
      this.langLabel.textContent = 'العربية';
    }

    // Appliquer les traductions sur tous les éléments data-i18n
    this.applyTranslations();

    // Re-rendre la vue actuelle pour rafraîchir les listes dynamiques traduites
    this.renderActiveView();
  }

  applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      
      // Gestion des placeholders d'inputs
      if (key.startsWith('[placeholder]')) {
        const actualKey = key.replace('[placeholder]', '');
        const text = this.t(actualKey);
        el.setAttribute('placeholder', text);
      } else {
        const text = this.t(key);
        // Si l'élément a des enfants SVG, on remplace juste le texte sans détruire le SVG
        const svg = el.querySelector('svg');
        if (svg) {
          // On garde le SVG et on change le span de texte interne
          const textSpan = el.querySelector('span[data-i18n]') || el.querySelector('span');
          if (textSpan) {
            textSpan.textContent = text;
          } else {
            // Si pas de span, on crée un nœud de texte
            el.innerHTML = svg.outerHTML + ` <span>${text}</span>`;
          }
        } else {
          el.textContent = text;
        }
      }
    });

    // Mettre à jour les titres de l'en-tête principal en fonction de la vue
    this.updateHeaderTitles();
  }

  t(key) {
    return translations[this.currentLang][key] || translations['fr'][key] || key;
  }

  // Charger les paramètres depuis Dexie
  async loadSettings() {
    const allSettings = await db.settings.toArray();
    allSettings.forEach(s => {
      this.settings[s.key] = s.value;
    });

    // Appliquer le nom de la boutique au logo de la sidebar
    const storeTitleLogo = document.getElementById('store-title-logo');
    if (storeTitleLogo && this.settings['boutique_name']) {
      storeTitleLogo.textContent = this.settings['boutique_name'];
    }
  }

  // Mettre à jour le fond de caisse affiché dans la sidebar
  async updateSidebarCaisse() {
    const balance = await this.calculateCaisseBalance();
    this.sidebarCaisseVal.textContent = `${balance.toFixed(0)} ${this.t('g_currency')}`;
    const dashCaisseValue = document.getElementById('dash-caisse-value');
    if (dashCaisseValue) {
      dashCaisseValue.textContent = `${balance.toFixed(0)} ${this.t('g_currency')}`;
    }
    const casaCurrentBalance = document.getElementById('casa-current-balance');
    if (casaCurrentBalance) {
      casaCurrentBalance.textContent = `${balance.toFixed(0)} ${this.t('g_currency')}`;
    }
  }

  async calculateCaisseBalance() {
    const entries = await db.caisse.toArray();
    let balance = 0;
    entries.forEach(e => {
      balance += e.amount; // amount est déjà positif pour cash_in / vente, négatif pour cash_out
    });
    return balance;
  }

  // Routage des Vues
  setupEventListeners() {
    // Bouton de langue
    this.langToggleBtn.addEventListener('click', () => {
      const nextLang = this.currentLang === 'fr' ? 'ar' : 'fr';
      this.setLanguage(nextLang);
    });

    // Liens de la barre latérale
    this.sidebarLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Boutons de fermeture des modals
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });

    // Soumission du formulaire client
    document.getElementById('client-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveClient();
    });

    // Soumission du formulaire produit
    document.getElementById('product-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveProduct();
    });

    // Soumission du formulaire d'opération caisse (Casa)
    document.getElementById('caisse-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveCaisseTransaction();
    });

    // Soumission du formulaire de stock
    document.getElementById('stock-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveStockMovement();
    });

    // Soumission du formulaire de paramètres
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveSettingsForm();
    });

    // Boutons d'ajouts rapides
    document.getElementById('add-client-btn')?.addEventListener('click', () => this.openClientModal());
    document.getElementById('pos-add-client-btn')?.addEventListener('click', () => this.openClientModal());
    document.getElementById('add-product-btn')?.addEventListener('click', () => this.openProductModal());
    
    // Mouvements de caisse manuels
    document.getElementById('casa-cash-in-btn')?.addEventListener('click', () => this.openCaisseModal('cash_in'));
    document.getElementById('casa-cash-out-btn')?.addEventListener('click', () => this.openCaisseModal('cash_out'));

    // Recherches temps réel
    document.getElementById('products-search')?.addEventListener('input', () => this.renderProductsList());
    document.getElementById('clients-search')?.addEventListener('input', () => this.renderClientsList());
    document.getElementById('pos-product-search')?.addEventListener('input', () => this.renderPOSProductsList());

    // Recherche client temps réel au POS
    document.getElementById('pos-client-search')?.addEventListener('input', (e) => {
      this.filterPOSClients(e.target.value);
    });

    document.getElementById('pos-client-select')?.addEventListener('change', (e) => {
      e.target.blur();
    });

    // Sélecteurs de rapports Caisse
    document.getElementById('btn-rep-day')?.addEventListener('click', (e) => this.switchCaisseReport('day', e.target));
    document.getElementById('btn-rep-week')?.addEventListener('click', (e) => this.switchCaisseReport('week', e.target));
    document.getElementById('btn-rep-month')?.addEventListener('click', (e) => this.switchCaisseReport('month', e.target));

    // Bouton de validation du panier (POS Checkout)
    document.getElementById('pos-checkout-btn')?.addEventListener('click', () => this.handleCheckout());

    // Sauvegarde DB
    document.getElementById('db-export-btn')?.addEventListener('click', () => this.exportDatabase());
    document.getElementById('db-import-file-input')?.addEventListener('change', (e) => this.importDatabase(e));

    // Soumissions formulaires Marques et Fournisseurs dans les Paramètres
    document.getElementById('brand-settings-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveBrand();
    });

    document.getElementById('supplier-settings-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveSupplier();
    });

    document.getElementById('settings-add-cash-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.addCaisseFundsFromSettings();
    });

    // Initialiser les gestionnaires d'image produit
    this.setupProductPictureHandlers();
    this.setupBrandLogoHandlers();
  }

  setupProductPictureHandlers() {
    const picInput = document.getElementById('prod-pic-input');
    const picRemoveBtn = document.getElementById('prod-pic-remove-btn');
    const picPreviewImg = document.getElementById('prod-pic-preview-img');
    const picPlaceholderIcon = document.getElementById('prod-pic-placeholder-icon');

    if (picInput) {
      picInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.currentProductPic = event.target.result;
            if (picPreviewImg) {
              picPreviewImg.src = this.currentProductPic;
              picPreviewImg.style.display = 'block';
            }
            if (picPlaceholderIcon) picPlaceholderIcon.style.display = 'none';
            if (picRemoveBtn) picRemoveBtn.style.display = 'block';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (picRemoveBtn) {
      picRemoveBtn.addEventListener('click', () => {
        this.currentProductPic = '';
        if (picInput) picInput.value = '';
        if (picPreviewImg) {
          picPreviewImg.src = '';
          picPreviewImg.style.display = 'none';
        }
        if (picPlaceholderIcon) picPlaceholderIcon.style.display = 'block';
        if (picRemoveBtn) picRemoveBtn.style.display = 'none';
      });
    }
  }

  setupBrandLogoHandlers() {
    const logoInput = document.getElementById('brand-logo-input');
    const logoRemoveBtn = document.getElementById('brand-logo-remove-btn');
    const logoPreviewImg = document.getElementById('brand-logo-preview-img');
    const logoPlaceholderIcon = document.getElementById('brand-logo-placeholder-icon');

    if (logoInput) {
      logoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.currentBrandLogo = event.target.result;
            if (logoPreviewImg) {
              logoPreviewImg.src = this.currentBrandLogo;
              logoPreviewImg.style.display = 'block';
            }
            if (logoPlaceholderIcon) logoPlaceholderIcon.style.display = 'none';
            if (logoRemoveBtn) logoRemoveBtn.style.display = 'block';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (logoRemoveBtn) {
      logoRemoveBtn.addEventListener('click', () => {
        this.currentBrandLogo = '';
        if (logoInput) logoInput.value = '';
        if (logoPreviewImg) {
          logoPreviewImg.src = '';
          logoPreviewImg.style.display = 'none';
        }
        if (logoPlaceholderIcon) logoPlaceholderIcon.style.display = 'block';
        if (logoRemoveBtn) logoRemoveBtn.style.display = 'none';
      });
    }
  }

  switchView(view) {
    this.activeView = view;
    
    // Mettre à jour les classes actives de la sidebar
    this.sidebarLinks.forEach(link => {
      if (link.getAttribute('data-view') === view) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Afficher la section correspondante
    this.sections.forEach(sec => {
      if (sec.id === `view-${view}`) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    // Mettre à jour l'en-tête
    this.updateHeaderTitles();

    // Rendre le contenu spécifique de la vue
    this.renderActiveView();
  }

  updateHeaderTitles() {
    this.pageTitle.textContent = this.t(`nav_${this.activeView}`);
    if (this.activeView === 'dashboard') {
      this.pageSubtitle.textContent = this.t('dash_tagline');
    } else {
      this.pageSubtitle.textContent = `${this.t('nav_' + this.activeView)} - Info Store`;
    }
  }

  async renderActiveView() {
    switch (this.activeView) {
      case 'dashboard':
        await this.renderDashboard();
        break;
      case 'pos':
        await this.renderPOS();
        break;
      case 'products':
        await this.renderProductsList();
        break;
      case 'clients':
        await this.renderClientsList();
        break;
      case 'stock':
        await this.renderStockView();
        break;
      case 'history':
        await this.renderInvoicesHistory();
        break;
      case 'casa':
        await this.renderCaisseView();
        break;
      case 'settings':
        await this.renderSettingsView();
        break;
    }
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  // ----------------------------------------------------
  // MODULE : DASHBOARD
  // ----------------------------------------------------
  async renderDashboard() {
    // 1. Calculer les ventes du jour
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const invoices = await db.invoices.toArray();
    let todaySales = 0;
    invoices.forEach(inv => {
      const invDate = new Date(inv.date);
      if (invDate >= today) {
        todaySales += inv.totalTTC;
      }
    });
    
    const dashSalesValue = document.getElementById('dash-sales-value');
    if (dashSalesValue) {
      dashSalesValue.textContent = `${todaySales.toFixed(0)} ${this.t('g_currency')}`;
    }

    // 2. Mettre à jour le solde de caisse
    await this.updateSidebarCaisse();

    // 3. Calculer les alertes de stock bas (quantité <= 2)
    const products = await db.products.toArray();
    let lowStockCount = 0;
    const alertItems = [];

    for (const p of products) {
      const stock = await this.getProductStock(p.id);
      if (stock <= 2) {
        lowStockCount++;
        alertItems.push({
          title: p.title,
          brand: p.brand,
          sn: p.serialNumber,
          stock: stock
        });
      }
    }

    const dashStockValue = document.getElementById('dash-stock-value');
    if (dashStockValue) {
      dashStockValue.textContent = lowStockCount;
      if (lowStockCount > 0) {
        dashStockValue.className = "stat-value danger";
      } else {
        dashStockValue.className = "stat-value success";
      }
    }

    // Afficher la liste des alertes de stock
    const alertListContainer = document.getElementById('dash-stock-alert-list');
    if (alertListContainer) {
      if (alertItems.length === 0) {
        alertListContainer.innerHTML = `
          <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 12px; padding: 16px; text-align: center; color: var(--success); font-size: 0.9rem;">
            ${this.t('dash_no_alert')}
          </div>
        `;
      } else {
        alertListContainer.innerHTML = alertItems.map(item => `
          <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 12px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 600; font-size: 0.95rem;">${item.title}</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${item.brand} | S/N: ${item.sn}</span>
            </div>
            <span class="badge badge-out" style="font-weight: 700;">${item.stock} ${this.t('stock_qty')}</span>
          </div>
        `).join('');
      }
    }

    // 4. Ventes Récentes (les 5 dernières factures)
    const recentSalesContainer = document.getElementById('dash-recent-sales-list');
    if (recentSalesContainer) {
      const sortedInvoices = invoices.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
      if (sortedInvoices.length === 0) {
        recentSalesContainer.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">${this.t('hist_no_factures')}</td>
          </tr>
        `;
      } else {
        recentSalesContainer.innerHTML = sortedInvoices.map(inv => `
          <tr>
            <td style="font-weight: 700; color: var(--primary);">${inv.invoiceNumber}</td>
            <td>${inv.clientName}</td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${this.formatDate(inv.date)}</td>
            <td style="font-weight: 700; color: var(--success);">${inv.totalTTC.toFixed(0)} ${this.t('g_currency')}</td>
          </tr>
        `).join('');
      }
    }
  }

  // Helper : Calcul du stock actuel pour un produit
  async getProductStock(productId) {
    const entries = await db.stock_entries.where('productId').equals(productId).toArray();
    let stock = 0;
    entries.forEach(e => {
      if (e.type === 'in') {
        stock += e.quantity;
      } else if (e.type === 'out') {
        stock -= e.quantity;
      } else if (e.type === 'adjust') {
        stock = e.quantity; // Ajustement direct
      }
    });
    return stock;
  }

  // Helper : Date formateur
  formatDate(isoString) {
    const date = new Date(isoString);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}`;
  }

  // ----------------------------------------------------
  // MODULE : GESTION CLIENTS
  // ----------------------------------------------------
  async openClientModal(clientOrId = null) {
    const modal = document.getElementById('client-modal');
    const title = document.getElementById('client-modal-title');
    const form = document.getElementById('client-form');
    
    // Réinitialiser les champs
    form.reset();
    document.getElementById('client-id-field').value = '';

    let client = null;
    if (typeof clientOrId === 'number') {
      client = await db.clients.get(clientOrId);
    } else if (clientOrId && typeof clientOrId === 'object') {
      client = clientOrId;
    }

    if (client) {
      title.textContent = this.t('client_edit');
      document.getElementById('client-id-field').value = client.id;
      document.getElementById('client-surname-input').value = client.surname;
      document.getElementById('client-name-input').value = client.name;
      document.getElementById('client-cin-input').value = client.cin;
      document.getElementById('client-phone-input').value = client.phone;
    } else {
      title.textContent = this.t('client_add');
    }

    modal.classList.add('active');
  }

  async saveClient() {
    const idField = document.getElementById('client-id-field').value;
    const surname = document.getElementById('client-surname-input').value.trim();
    const name = document.getElementById('client-name-input').value.trim();
    const cin = document.getElementById('client-cin-input').value.trim();
    const phone = document.getElementById('client-phone-input').value.trim();

    const clientData = { surname, name, cin, phone };

    try {
      if (idField) {
        // Mode Modification
        await db.clients.update(Number(idField), clientData);
        alert(this.t('client_updated_success'));
      } else {
        // Mode Ajout
        await db.clients.add(clientData);
        alert(this.t('client_added_success'));
      }
      this.closeAllModals();
      await this.renderClientsList();
      
      // Si on est sur l'écran POS, on rafraîchit la liste des clients
      if (this.activeView === 'pos') {
        await this.renderPOS();
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sauvegarde du client.");
    }
  }

  async deleteClient(id) {
    if (confirm(this.t('g_confirm_delete'))) {
      await db.clients.delete(id);
      alert(this.t('client_deleted_success'));
      await this.renderClientsList();
    }
  }

  async renderClientsList() {
    const listTable = document.getElementById('clients-list-table');
    if (!listTable) return;

    const query = document.getElementById('clients-search')?.value.toLowerCase().trim() || '';
    let clients = await db.clients.toArray();

    if (query) {
      clients = clients.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.surname.toLowerCase().includes(query) || 
        c.cin.includes(query) ||
        c.phone.includes(query)
      );
    }

    if (clients.length === 0) {
      listTable.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">${this.t('client_no_clients')}</td>
        </tr>
      `;
    } else {
      listTable.innerHTML = clients.map(c => `
        <tr>
          <td style="font-weight: 600;">${c.surname}</td>
          <td style="font-weight: 600;">${c.name}</td>
          <td style="font-family: monospace;">${c.cin}</td>
          <td>${c.phone}</td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-icon-only" onclick="window.app.openClientModal(${c.id})" title="${this.t('g_edit')}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  // ----------------------------------------------------
  // MODULE : GESTION PRODUITS
  // ----------------------------------------------------
  async openProductModal(productOrId = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');
    
    // Réinitialiser les champs
    form.reset();
    document.getElementById('product-id-field').value = '';

    // Remplir les marques depuis settings
    const brandSuggestions = document.getElementById('brand-suggestions');
    if (brandSuggestions) {
      const brands = this.settings['brands'] || [];
      brandSuggestions.innerHTML = brands.map(b => `<option value="${b.name}">`).join('');
    }

    // Remplir les fournisseurs depuis settings
    const supplierSuggestions = document.getElementById('supplier-suggestions');
    if (supplierSuggestions) {
      const suppliers = this.settings['suppliers'] || [];
      supplierSuggestions.innerHTML = suppliers.map(s => `<option value="${s}">`).join('');
    }

    document.getElementById('prod-tva-input').value = '7'; // Valeur par défaut libre

    this.currentProductPic = '';
    const picPreviewImg = document.getElementById('prod-pic-preview-img');
    const picPlaceholderIcon = document.getElementById('prod-pic-placeholder-icon');
    const picRemoveBtn = document.getElementById('prod-pic-remove-btn');

    let product = null;
    if (typeof productOrId === 'number') {
      product = await db.products.get(productOrId);
    } else if (productOrId && typeof productOrId === 'object') {
      product = productOrId;
    }

    if (product) {
      title.textContent = this.t('prod_edit');
      document.getElementById('product-id-field').value = product.id;
      document.getElementById('prod-title-input').value = product.title;
      const brandInput = document.getElementById('prod-brand-input');
      const supplierInput = document.getElementById('prod-supplier-input');
      if (brandInput) brandInput.value = product.brand || '';
      if (supplierInput) supplierInput.value = product.supplier || '';
      document.getElementById('prod-sn-input').value = product.serialNumber;
      document.getElementById('prod-tva-input').value = product.tvaRate;
      document.getElementById('prod-price-factory-input').value = product.priceFactory.toFixed(0);
      document.getElementById('prod-price-sale-input').value = product.priceSale.toFixed(0);
      document.getElementById('prod-desc-input').value = product.description;

      if (product.picture) {
        this.currentProductPic = product.picture;
        if (picPreviewImg) {
          picPreviewImg.src = product.picture;
          picPreviewImg.style.display = 'block';
        }
        if (picPlaceholderIcon) picPlaceholderIcon.style.display = 'none';
        if (picRemoveBtn) picRemoveBtn.style.display = 'block';
      } else {
        if (picPreviewImg) {
          picPreviewImg.src = '';
          picPreviewImg.style.display = 'none';
        }
        if (picPlaceholderIcon) picPlaceholderIcon.style.display = 'block';
        if (picRemoveBtn) picRemoveBtn.style.display = 'none';
      }
    } else {
      title.textContent = this.t('prod_add');
      if (picPreviewImg) {
        picPreviewImg.src = '';
        picPreviewImg.style.display = 'none';
      }
      if (picPlaceholderIcon) picPlaceholderIcon.style.display = 'block';
      if (picRemoveBtn) picRemoveBtn.style.display = 'none';
    }

    modal.classList.add('active');
  }

  async saveProduct() {
    const idField = document.getElementById('product-id-field').value;
    const title = document.getElementById('prod-title-input').value.trim();
    const brandInput = document.getElementById('prod-brand-input');
    const supplierInput = document.getElementById('prod-supplier-input');
    const brand = brandInput ? brandInput.value.trim() : '';
    const supplier = supplierInput ? supplierInput.value.trim() : '';

    if (!brand || !supplier) {
      alert("Veuillez saisir une marque et un fournisseur !");
      return;
    }

    // Enregistrer automatiquement la nouvelle marque dans les paramètres si elle n'existe pas
    let brands = this.settings['brands'] || [];
    if (brand && !brands.some(b => b.name.toLowerCase() === brand.toLowerCase())) {
      brands.push({ name: brand, logo: '' });
      await db.settings.put({ key: 'brands', value: brands });
      this.settings['brands'] = brands;
    }

    // Enregistrer automatiquement le nouveau fournisseur dans les paramètres s'il n'existe pas
    let suppliers = this.settings['suppliers'] || [];
    if (supplier && !suppliers.some(s => s.toLowerCase() === supplier.toLowerCase())) {
      suppliers.push(supplier);
      await db.settings.put({ key: 'suppliers', value: suppliers });
      this.settings['suppliers'] = suppliers;
    }
    const serialNumber = document.getElementById('prod-sn-input').value.trim();
    const tvaRate = Number(document.getElementById('prod-tva-input').value);
    const priceFactory = Number(document.getElementById('prod-price-factory-input').value);
    const priceSale = Number(document.getElementById('prod-price-sale-input').value);
    const description = document.getElementById('prod-desc-input').value.trim();

    const productData = { 
      title, brand, supplier, serialNumber, tvaRate, 
      priceFactory, priceSale, description, picture: this.currentProductPic || ''
    };

    try {
      if (idField) {
        // Mode Modification
        await db.products.update(Number(idField), productData);
        alert(this.t('prod_updated_success'));
      } else {
        // Mode Ajout : Empêcher doublon S/N
        const existing = await db.products.where('serialNumber').equalsIgnoreCase(serialNumber).first();
        if (existing) {
          alert("Erreur : Un produit avec ce numéro de série (S/N) existe déjà !");
          return;
        }

        const newProdId = await db.products.add(productData);
        // On crée automatiquement un mouvement de stock initial égal à 0
        await db.stock_entries.add({
          productId: newProdId,
          quantity: 0,
          type: 'in',
          date: new Date().toISOString(),
          description: 'Initialisation produit'
        });
        alert(this.t('prod_added_success'));
      }
      this.closeAllModals();
      await this.renderProductsList();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sauvegarde du produit.");
    }
  }

  async deleteProduct(id) {
    if (confirm(this.t('g_confirm_delete'))) {
      // Supprimer le produit et ses mouvements de stock correspondants
      await db.products.delete(id);
      await db.stock_entries.where('productId').equals(id).delete();
      alert(this.t('prod_deleted_success'));
      await this.renderProductsList();
    }
  }

  async renderProductsList() {
    const listTable = document.getElementById('products-list-table');
    if (!listTable) return;

    const query = document.getElementById('products-search')?.value.toLowerCase().trim() || '';
    let products = await db.products.toArray();

    if (query) {
      products = products.filter(p => 
        p.title.toLowerCase().includes(query) || 
        p.brand.toLowerCase().includes(query) || 
        p.serialNumber.toLowerCase().includes(query) ||
        p.supplier.toLowerCase().includes(query)
      );
    }

    if (products.length === 0) {
      listTable.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">${this.t('prod_no_products')}</td>
        </tr>
      `;
    } else {
      const rows = [];
      for (const p of products) {
        const stock = await this.getProductStock(p.id);
        const stockClass = stock <= 2 ? 'badge badge-out' : 'badge badge-in';
        
        // Trouver le logo de la marque
        const brandObj = (this.settings['brands'] || []).find(b => b.name === p.brand);
        const brandLogoHtml = brandObj && brandObj.logo ? `<img src="${brandObj.logo}" style="width: 18px; height: 18px; object-fit: cover; border-radius: 4px; vertical-align: middle; margin-right: 6px;">` : '';

        rows.push(`
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 38px; height: 38px; border-radius: 8px; border: 1px solid var(--glass-border); overflow: hidden; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); flex-shrink: 0;">
                  ${p.picture ? `<img src="${p.picture}" style="width: 100%; height: 100%; object-fit: cover;">` : `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  `}
                </div>
                <div style="display: flex; flex-direction: column;">
                  <span style="font-weight: 700;">${p.title}</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.description || '-'}</span>
                </div>
              </div>
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                ${brandLogoHtml}
                <span style="font-weight: 600;">${p.brand}</span>
              </div>
            </td>
            <td style="font-family: monospace;">${p.serialNumber}</td>
            <td style="font-weight: 600;">${p.priceFactory.toFixed(0)} ${this.t('g_currency')}</td>
            <td style="font-weight: 700; color: var(--accent-cyan);">${p.priceSale.toFixed(0)} ${this.t('g_currency')}</td>
            <td style="font-weight: 600; color: var(--text-muted);">${p.tvaRate}%</td>
            <td><span class="${stockClass}">${stock}</span></td>
            <td>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary btn-icon-only" onclick="window.app.openProductModal(${p.id})" title="${this.t('g_edit')}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `);
      }
      listTable.innerHTML = rows.join('');
    }
  }

  // ----------------------------------------------------
  // MODULE : CAISSE & VENTES (POS)
  // ----------------------------------------------------
  async renderPOS() {
    // 1. Remplir le sélecteur de clients
    const clientSelect = document.getElementById('pos-client-select');
    if (clientSelect) {
      this.allClients = await db.clients.toArray();
      this.filterPOSClients('');
      // Réinitialiser la recherche
      const clientSearch = document.getElementById('pos-client-search');
      if (clientSearch) clientSearch.value = '';
    }

    // 2. Rendre les produits disponibles
    await this.renderPOSProductsList();

    // 3. Rafraîchir le panier
    this.renderCart();
  }

  filterPOSClients(query) {
    const clientSelect = document.getElementById('pos-client-select');
    if (!clientSelect) return;

    if (!this.allClients) {
      this.allClients = [];
    }

    const q = query.toLowerCase().trim();
    const filtered = this.allClients.filter(c => 
      (c.surname || '').toLowerCase().includes(q) || 
      (c.name || '').toLowerCase().includes(q) || 
      (c.cin || '').includes(q) || 
      (c.phone || '').includes(q)
    );

    if (filtered.length === 0) {
      clientSelect.innerHTML = `<option value="" disabled selected>Aucun client trouvé</option>`;
    } else {
      clientSelect.innerHTML = filtered.map(c => `
        <option value="${c.id}">${c.surname} ${c.name} (${this.t('pos_cin')}: ${c.cin})</option>
      `).join('');
    }
  }

  async renderPOSProductsList() {
    const productsList = document.getElementById('pos-products-list');
    if (!productsList) return;

    const query = document.getElementById('pos-product-search')?.value.toLowerCase().trim() || '';
    let products = await db.products.toArray();

    if (query) {
      products = products.filter(p => 
        p.title.toLowerCase().includes(query) || 
        p.brand.toLowerCase().includes(query) || 
        p.serialNumber.toLowerCase().includes(query)
      );
    }

    const rows = [];
    for (const p of products) {
      const stock = await this.getProductStock(p.id);
      
      rows.push(`
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--glass-border); overflow: hidden; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); flex-shrink: 0;">
                ${p.picture ? `<img src="${p.picture}" style="width: 100%; height: 100%; object-fit: cover;">` : `
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                `}
              </div>
              <div style="display: flex; flex-direction: column;">
                <span style="font-weight: 700; font-size: 0.9rem;">${p.title}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${p.brand}</span>
              </div>
            </div>
          </td>
          <td style="font-family: monospace; font-size: 0.8rem;">${p.serialNumber}</td>
          <td>
            <span class="${stock <= 2 ? 'badge badge-out' : 'badge badge-in'}">${stock}</span>
          </td>
          <td style="font-weight: 700; color: var(--accent-cyan);">${p.priceSale.toFixed(0)} ${this.t('g_currency')}</td>
          <td>
            <button class="btn btn-primary btn-icon-only" style="padding: 6px;" onclick="window.app.addToCart(${p.id})" ${stock <= 0 ? 'disabled' : ''}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            </button>
          </td>
        </tr>
      `);
    }
    productsList.innerHTML = rows.join('');
  }

  async addToCart(productId) {
    const product = await db.products.get(productId);
    if (!product) return;

    const stock = await this.getProductStock(productId);
    const cartItem = this.cart.find(item => item.product.id === productId);

    if (cartItem) {
      if (cartItem.quantity >= stock) {
        alert(this.t('pos_stock_error'));
        return;
      }
      cartItem.quantity++;
    } else {
      if (stock <= 0) {
        alert(this.t('pos_stock_error'));
        return;
      }
      this.cart.push({ product, quantity: 1 });
    }

    this.renderCart();
  }

  removeFromCart(productId) {
    this.cart = this.cart.filter(item => item.product.id !== productId);
    this.renderCart();
  }

  adjustCartQty(productId, amount) {
    const cartItem = this.cart.find(item => item.product.id === productId);
    if (!cartItem) return;

    this.getProductStock(productId).then(stock => {
      const newQty = cartItem.quantity + amount;
      if (newQty <= 0) {
        this.removeFromCart(productId);
      } else if (newQty > stock) {
        alert(this.t('pos_stock_error'));
      } else {
        cartItem.quantity = newQty;
        this.renderCart();
      }
    });
  }

  renderCart() {
    const cartContainer = document.getElementById('pos-cart-items');
    if (!cartContainer) return;

    if (this.cart.length === 0) {
      cartContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 0;" data-i18n="pos_empty_cart">${this.t('pos_empty_cart')}</div>`;
      
      document.getElementById('pos-total-ht').textContent = `0.000 ${this.t('g_currency')}`;
      document.getElementById('pos-total-tva').textContent = `0.000 ${this.t('g_currency')}`;
      document.getElementById('pos-total-ttc').textContent = `0.000 ${this.t('g_currency')}`;
      return;
    }

    // Calculs de TVA et totaux
    let totalHT = 0;
    let totalTVA = 0;
    const timbre = this.settings['timbre_fiscal'] || 1.000;

    cartContainer.innerHTML = this.cart.map(item => {
      const p = item.product;
      const subtotalHT = p.priceSale * item.quantity;
      const tvaAmount = subtotalHT * (p.tvaRate / 100);
      
      totalHT += subtotalHT;
      totalTVA += tvaAmount;

      return `
        <div class="cart-item">
          <div class="cart-item-info">
            <span class="cart-item-title">${p.title}</span>
            <span class="cart-item-sub">${p.brand} | S/N: ${p.serialNumber} | TVA: ${p.tvaRate}%</span>
          </div>
          <div class="cart-item-qty-actions">
            <button class="btn btn-secondary btn-icon-only" style="padding: 4px;" onclick="window.app.adjustCartQty(${p.id}, -1)">-</button>
            <span class="cart-qty-val">${item.quantity}</span>
            <button class="btn btn-secondary btn-icon-only" style="padding: 4px;" onclick="window.app.adjustCartQty(${p.id}, 1)">+</button>
          </div>
          <span class="cart-price-sum">${subtotalHT.toFixed(0)} ${this.t('g_currency')}</span>
          <button class="btn btn-danger btn-icon-only" style="padding: 6px;" onclick="window.app.removeFromCart(${p.id})">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>
      `;
    }).join('');

    const totalTTC = totalHT + totalTVA + timbre;

    document.getElementById('pos-total-ht').textContent = `${totalHT.toFixed(0)} ${this.t('g_currency')}`;
    document.getElementById('pos-total-tva').textContent = `${totalTVA.toFixed(0)} ${this.t('g_currency')}`;
    document.getElementById('pos-stamp-val').textContent = `${timbre.toFixed(0)} ${this.t('g_currency')}`;
    document.getElementById('pos-total-ttc').textContent = `${totalTTC.toFixed(0)} ${this.t('g_currency')}`;
  }

  async handleCheckout() {
    if (this.cart.length === 0) {
      alert(this.t('pos_empty_cart'));
      return;
    }

    const clientId = Number(document.getElementById('pos-client-select').value);
    if (!clientId) {
      alert("Veuillez sélectionner ou ajouter un client.");
      return;
    }

    const client = await db.clients.get(clientId);
    if (!client) return;

    // Début de la transaction
    try {
      const now = new Date().toISOString();
      const lastInvoice = await db.invoices.orderBy('id').last();
      const nextId = lastInvoice ? lastInvoice.id + 1 : 1;
      const invoiceNumber = String(nextId).padStart(4, '0');
      const timbre = this.settings['timbre_fiscal'] || 1.000;

      let totalHT = 0;
      let totalTVA = 0;
      const itemsJSON = [];
      const tvaBreakdown = {}; // Permet de regrouper la TVA par taux

      // 1. Déduire les stocks et préparer les lignes de facture
      for (const item of this.cart) {
        const p = item.product;
        const subtotalHT = p.priceSale * item.quantity;
        const tvaAmount = subtotalHT * (p.tvaRate / 100);
        
        totalHT += subtotalHT;
        totalTVA += tvaAmount;

        if (!tvaBreakdown[p.tvaRate]) {
          tvaBreakdown[p.tvaRate] = 0;
        }
        tvaBreakdown[p.tvaRate] += tvaAmount;

        // Soustraire du stock
        await db.stock_entries.add({
          productId: p.id,
          quantity: item.quantity,
          type: 'out',
          date: now,
          description: `Vente Facture ${invoiceNumber}`
        });

        itemsJSON.push({
          productId: p.id,
          title: p.title,
          brand: p.brand,
          serialNumber: p.serialNumber,
          priceSale: p.priceSale,
          quantity: item.quantity,
          tvaRate: p.tvaRate,
          totalHT: subtotalHT,
          totalTVA: tvaAmount,
          totalTTC: subtotalHT + tvaAmount
        });
      }

      const totalTTC = totalHT + totalTVA + timbre;

      // 2. Enregistrer la facture
      const invoiceId = await db.invoices.add({
        invoiceNumber,
        date: now,
        clientId: client.id,
        clientName: `${client.surname} ${client.name}`,
        clientPhone: client.phone,
        clientCIN: client.cin,
        items: itemsJSON,
        totalHT,
        totalTVA,
        timbre,
        totalTTC,
        tvaBreakdown
      });

      // 3. Enregistrer en Caisse (Casa)
      const currentCaisse = await this.calculateCaisseBalance();
      await db.caisse.add({
        date: now,
        amount: totalTTC, // Entrée d'argent positive
        type: 'sale',
        invoiceId: invoiceId,
        description: `Vente Facture ${invoiceNumber}`,
        currentTotal: currentCaisse + totalTTC
      });

      alert(this.t('pos_sale_success'));

      // 4. Générer la Facture A4 à l'impression
      this.preparePrintInvoice(invoiceNumber, now, client, itemsJSON, totalHT, tvaBreakdown, timbre, totalTTC);

      // Déclencher l'impression native
      if (window.electronAPI && window.electronAPI.printWindow) {
        await window.electronAPI.printWindow();
      } else {
        window.print(); // Fallback navigateur standard
      }

      // Vider le panier et rafraîchir
      this.cart = [];
      await this.init(); // recharge tout le dashboard, caisse et POS
      this.switchView('dashboard');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la validation de la vente.");
    }
  }

  // Injecter les données de facture dans le layout A4 HTML de print
  preparePrintInvoice(invoiceNumber, date, client, items, totalHT, tvaBreakdown, timbre, totalTTC) {
    // Info boutique
    document.getElementById('p-store-name').textContent = this.settings['boutique_name'] || 'Info Store';
    document.getElementById('p-store-address').textContent = this.settings['boutique_address'] || '';
    document.getElementById('p-store-phone').textContent = `Tél : ${this.settings['boutique_phone'] || ''}`;

    // Meta Facture
    document.getElementById('p-inv-number').textContent = invoiceNumber;
    document.getElementById('p-inv-date').textContent = this.formatDate(date);

    // Client
    document.getElementById('p-client-name').textContent = `${client.surname} ${client.name}`;
    document.getElementById('p-client-phone').textContent = client.phone;
    document.getElementById('p-client-cin').textContent = client.cin;

    // Tableau des articles
    const tableBody = document.getElementById('p-invoice-items');
    tableBody.innerHTML = items.map(item => `
      <tr>
        <td style="font-weight:700;">${item.title} (${item.brand})</td>
        <td style="font-family: monospace;">${item.serialNumber}</td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">${item.priceSale.toFixed(0)}</td>
        <td style="text-align: right;">${item.tvaRate}%</td>
      </tr>
    `).join('');

    // Traduction dynamique des labels de facture selon la langue
    const invTitle = document.getElementById('p-inv-title');
    const invNumLabel = document.getElementById('p-inv-num-label');
    const invDateLabel = document.getElementById('p-inv-date-label');
    const invClientLabel = document.getElementById('p-inv-client-label');
    const cliNameLabel = document.getElementById('p-cli-name-label');
    const cliPhoneLabel = document.getElementById('p-cli-phone-label');
    const cliCinLabel = document.getElementById('p-cli-cin-label');
    const colItem = document.getElementById('p-col-item');
    const colSn = document.getElementById('p-col-sn');
    const colQty = document.getElementById('p-col-qty');
    const colPrice = document.getElementById('p-col-price');
    const colTva = document.getElementById('p-col-tva');
    const totalHtLabel = document.getElementById('p-total-ht-label');
    const stampLabel = document.getElementById('p-stamp-label');
    const totalTtcLabel = document.getElementById('p-total-ttc-label');
    const sigClient = document.getElementById('p-sig-client');
    const sigBoutique = document.getElementById('p-sig-boutique');
    const noteTitle = document.getElementById('p-note-title');
    const noteContent = document.getElementById('p-note-content');

    if (this.currentLang === 'ar') {
      invTitle.textContent = 'فاتورة بيع';
      invNumLabel.textContent = 'فاتورة رقم :';
      invDateLabel.textContent = 'التاريخ والوقت :';
      invClientLabel.textContent = 'بيانات الحريف';
      cliNameLabel.textContent = 'الحريف :';
      cliPhoneLabel.textContent = 'الهاتف :';
      cliCinLabel.textContent = 'بطاقة تعريف :';
      colItem.textContent = 'المنتج';
      colSn.textContent = 'الرقم التسلسلي S/N';
      colQty.textContent = 'الكمية';
      colPrice.textContent = 'سعر الوحدة HT';
      colTva.textContent = 'الأداء TVA';
      totalHtLabel.textContent = 'المجموع بدون أداء (HT)';
      stampLabel.textContent = 'المعلوم الجبائي';
      totalTtcLabel.textContent = 'الصافي للدفع (TTC)';
      if (sigClient) sigClient.textContent = 'إمضاء الحريف';
      sigBoutique.textContent = 'Info Store (ختم وإمضاء المحل)';
      if (noteTitle) noteTitle.textContent = 'ملاحظات :';
      if (noteContent) noteContent.textContent = 'البضاعة المباعة لا ترد ولا تستبدل بعد 3 أيام. الضمان ساري المفعول فقط عند الاستظهار بهذه الفاتورة.';
    } else {
      invTitle.textContent = 'FACTURE';
      invNumLabel.textContent = 'Facture N° :';
      invDateLabel.textContent = 'Date/Heure :';
      invClientLabel.textContent = 'DÉTAILS DU CLIENT';
      cliNameLabel.textContent = 'Client :';
      cliPhoneLabel.textContent = 'Téléphone :';
      cliCinLabel.textContent = 'CIN (ID) :';
      colItem.textContent = 'Description Produit';
      colSn.textContent = 'Numéro de Série (S/N)';
      colQty.textContent = 'Qté';
      colPrice.textContent = 'P.U HT (TND)';
      colTva.textContent = 'TVA (%)';
      totalHtLabel.textContent = 'Total Hors Taxes (HT)';
      stampLabel.textContent = 'Timbre Fiscal';
      totalTtcLabel.textContent = 'Net à Payer (TTC)';
      if (sigClient) sigClient.textContent = 'Signature Client';
      sigBoutique.textContent = 'Info Store (Cachet & Signature)';
      if (noteTitle) noteTitle.textContent = 'Notes :';
      if (noteContent) noteContent.textContent = 'Les marchandises vendues ne sont ni reprises ni échangées après 3 jours. Garantie valide sur présentation de cette facture.';
    }

    // Calculs de résumé à l'impression
    document.getElementById('p-total-ht-val').textContent = `${totalHT.toFixed(0)} ${this.t('g_currency')}`;
    document.getElementById('p-stamp-val-print').textContent = `${timbre.toFixed(0)} ${this.t('g_currency')}`;
    document.getElementById('p-total-ttc-val').textContent = `${totalTTC.toFixed(0)} ${this.t('g_currency')}`;

    // Rendre le tableau des lignes de TVA (regroupées)
    const tvaRows = document.getElementById('p-tva-breakdown-rows');
    tvaRows.innerHTML = Object.entries(tvaBreakdown).map(([rate, amount]) => `
      <td style="font-size:9.5pt;">Total TVA ${rate}%</td>
      <td style="text-align: right; font-weight: 600; font-size:9.5pt;">${amount.toFixed(0)} ${this.t('g_currency')}</td>
    `).join('');
  }

  // ----------------------------------------------------
  // MODULE : MOUVEMENTS STOCK
  // ----------------------------------------------------
  async renderStockView() {
    // 1. Remplir la liste des produits dans le formulaire
    const productSelect = document.getElementById('stock-product-select');
    if (productSelect) {
      const products = await db.products.toArray();
      productSelect.innerHTML = products.map(p => `
        <option value="${p.id}">${p.title} (${p.brand} | S/N: ${p.serialNumber})</option>
      `).join('');
    }

    // 2. Afficher l'historique complet du stock
    const movementsTable = document.getElementById('stock-movements-table');
    if (movementsTable) {
      const entries = await db.stock_entries.toArray();
      // Trier du plus récent au plus ancien
      const sorted = entries.sort((a, b) => new Date(b.date) - new Date(a.date));

      if (sorted.length === 0) {
        movementsTable.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">${this.t('stock_no_history')}</td>
          </tr>
        `;
      } else {
        const rows = [];
        for (const e of sorted) {
          const product = await db.products.get(e.productId);
          let typeBadge = '';
          if (e.type === 'in') {
            typeBadge = `<span class="badge badge-in">${this.t('stock_type_in')}</span>`;
          } else if (e.type === 'out') {
            typeBadge = `<span class="badge badge-out">${this.t('stock_type_out')}</span>`;
          } else {
            typeBadge = `<span class="badge badge-adjust">${this.t('stock_type_adjust')}</span>`;
          }

          rows.push(`
            <tr>
              <td style="font-size: 0.85rem; color: var(--text-muted);">${this.formatDate(e.date)}</td>
              <td style="font-weight: 700;">${product ? product.title : 'Produit supprimé'}</td>
              <td style="font-weight: 700; text-align: center;">${e.quantity}</td>
              <td>${typeBadge}</td>
              <td style="font-size: 0.9rem;">${e.description || '-'}</td>
            </tr>
          `);
        }
        movementsTable.innerHTML = rows.join('');
      }
    }
  }

  async saveStockMovement() {
    const productId = Number(document.getElementById('stock-product-select').value);
    const quantity = Number(document.getElementById('stock-qty-input').value);
    const type = document.getElementById('stock-type-select').value;
    const description = document.getElementById('stock-desc-input').value.trim();

    if (!productId || quantity <= 0) return;

    try {
      await db.stock_entries.add({
        productId,
        quantity,
        type,
        date: new Date().toISOString(),
        description
      });

      alert(this.t('stock_added_success'));
      document.getElementById('stock-form').reset();
      await this.renderStockView();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement du stock.");
    }
  }

  // ----------------------------------------------------
  // MODULE : HISTORIQUE DES FACTURES
  // ----------------------------------------------------
  async renderInvoicesHistory() {
    const historyTable = document.getElementById('invoices-list-table');
    if (!historyTable) return;

    const invoices = await db.invoices.toArray();
    const sorted = invoices.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sorted.length === 0) {
      historyTable.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">${this.t('hist_no_factures')}</td>
        </tr>
      `;
    } else {
      historyTable.innerHTML = sorted.map(inv => `
        <tr>
          <td style="font-weight: 700; color: var(--primary);">${inv.invoiceNumber}</td>
          <td style="font-weight: 600;">${inv.clientName}</td>
          <td style="font-size: 0.85rem; color: var(--text-muted);">${this.formatDate(inv.date)}</td>
          <td>${inv.totalHT.toFixed(0)} ${this.t('g_currency')}</td>
          <td>${inv.totalTVA.toFixed(0)} ${this.t('g_currency')}</td>
          <td style="font-weight: 800; color: var(--accent-cyan);">${inv.totalTTC.toFixed(0)} ${this.t('g_currency')}</td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.app.reprintInvoice(${inv.id})">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                <span style="margin-left: 4px;">${this.t('hist_print')}</span>
              </button>
              <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.app.refundInvoice(${inv.id})">
                <span style="font-weight: 500;">${this.t('hist_refund')}</span>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  async reprintInvoice(id) {
    const inv = await db.invoices.get(id);
    if (!inv) return;

    const client = {
      surname: '',
      name: inv.clientName,
      phone: inv.clientPhone,
      cin: inv.clientCIN
    };

    this.preparePrintInvoice(inv.invoiceNumber, inv.date, client, inv.items, inv.totalHT, inv.tvaBreakdown, inv.timbre, inv.totalTTC);

    if (window.electronAPI && window.electronAPI.printWindow) {
      await window.electronAPI.printWindow();
    } else {
      window.print();
    }
  }

  async refundInvoice(id) {
    const inv = await db.invoices.get(id);
    if (!inv) return;

    if (confirm("Êtes-vous sûr de vouloir annuler cette vente et restaurer le stock ?")) {
      try {
        const now = new Date().toISOString();
        
        // 1. Restaurer le stock (ajouter type 'in')
        for (const item of inv.items) {
          await db.stock_entries.add({
            productId: item.productId,
            quantity: item.quantity,
            type: 'in',
            date: now,
            description: `Restauration de stock - Annulation Facture ${inv.invoiceNumber}`
          });
        }

        // 2. Annuler en Caisse (ajouter une opération négative de Casa)
        const currentCaisse = await this.calculateCaisseBalance();
        await db.caisse.add({
          date: now,
          amount: -inv.totalTTC, // Négatif car c'est un remboursement / sortie
          type: 'cash_out',
          invoiceId: null,
          description: `Remboursement Facture ${inv.invoiceNumber}`,
          currentTotal: currentCaisse - inv.totalTTC
        });

        // 3. Supprimer la facture de l'historique
        await db.invoices.delete(id);

        alert(this.t('hist_refund_success'));
        await this.init();
        this.switchView('history');
      } catch (err) {
        console.error(err);
        alert("Erreur lors de l'annulation de la facture.");
      }
    }
  }

  // ----------------------------------------------------
  // MODULE : RAPPORTS DE CAISSE (CASA)
  // ----------------------------------------------------
  openCaisseModal(type) {
    const modal = document.getElementById('caisse-modal');
    const title = document.getElementById('caisse-modal-title');
    const typeField = document.getElementById('caisse-trans-type');
    
    document.getElementById('caisse-form').reset();
    typeField.value = type;

    if (type === 'cash_in') {
      title.textContent = this.t('casa_cash_in');
      title.style.color = 'var(--success)';
    } else {
      title.textContent = this.t('casa_cash_out');
      title.style.color = 'var(--danger)';
    }

    modal.classList.add('active');
  }

  async saveCaisseTransaction() {
    const type = document.getElementById('caisse-trans-type').value;
    const amountVal = Number(document.getElementById('caisse-amount-input').value);
    const description = document.getElementById('caisse-reason-input').value.trim();

    if (amountVal <= 0 || !description) return;

    try {
      const now = new Date().toISOString();
      const currentCaisse = await this.calculateCaisseBalance();
      
      // cash_in => positif, cash_out => négatif
      const amount = type === 'cash_in' ? amountVal : -amountVal;

      await db.caisse.add({
        date: now,
        amount: amount,
        type: type,
        invoiceId: null,
        description: description,
        currentTotal: currentCaisse + amount
      });

      alert(this.t('casa_added_success'));
      this.closeAllModals();
      await this.init(); // recalculer tout
      this.switchView('casa');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'opération de caisse.");
    }
  }

  async switchCaisseReport(period, targetBtn) {
    // Boutons actifs
    document.querySelectorAll('[id^="btn-rep-"]').forEach(btn => btn.classList.remove('active'));
    targetBtn.classList.add('active');

    await this.renderCaisseView(period);
  }

  async renderCaisseView(period = 'day') {
    const tableBody = document.getElementById('casa-movements-table');
    if (!tableBody) return;

    const entries = await db.caisse.toArray();
    const now = new Date();
    let startDate = new Date();

    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0); // Aujourd'hui depuis 00:00
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7); // Les 7 derniers jours
    } else if (period === 'month') {
      startDate.setDate(now.getDate() - 30); // Les 30 derniers jours
    }

    const filtered = entries.filter(e => new Date(e.date) >= startDate);
    const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculer les totaux de la période filtrée
    let totalIn = 0;
    let totalOut = 0;

    filtered.forEach(e => {
      if (e.amount > 0) {
        totalIn += e.amount;
      } else {
        totalOut += Math.abs(e.amount);
      }
    });

    document.getElementById('casa-total-inputs').textContent = `${totalIn.toFixed(0)} ${this.t('g_currency')}`;
    document.getElementById('casa-total-outputs').textContent = `${totalOut.toFixed(0)} ${this.t('g_currency')}`;

    if (sorted.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">${this.t('casa_no_trans')}</td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = sorted.map(e => {
        let typeBadge = '';
        let amountText = '';

        if (e.amount > 0) {
          typeBadge = `<span class="badge badge-in">${this.t('casa_cash_in')}</span>`;
          amountText = `<span style="color: var(--success); font-weight:700;">+${e.amount.toFixed(0)}</span>`;
        } else {
          typeBadge = `<span class="badge badge-out">${this.t('casa_cash_out')}</span>`;
          amountText = `<span style="color: var(--danger); font-weight:700;">${e.amount.toFixed(0)}</span>`;
        }

        return `
          <tr>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${this.formatDate(e.date)}</td>
            <td>${amountText} ${this.t('g_currency')}</td>
            <td>${typeBadge}</td>
            <td style="font-size: 0.95rem; font-weight: 600;">${e.description}</td>
            <td style="font-weight: 700; color: var(--text-light);">${e.currentTotal.toFixed(0)} ${this.t('g_currency')}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // ----------------------------------------------------
  // MODULE : PARAMÈTRES
  // ----------------------------------------------------
  renderSettingsView() {
    document.getElementById('set-name-input').value = this.settings['boutique_name'] || 'Info Store';
    document.getElementById('set-phone-input').value = this.settings['boutique_phone'] || '';
    document.getElementById('set-address-input').value = this.settings['boutique_address'] || '';
    
    const rates = this.settings['tva_rates'] || [7, 19];
    document.getElementById('set-tva-input').value = rates.join(', ');

    const stamp = this.settings['timbre_fiscal'] || 1.000;
    document.getElementById('set-stamp-input').value = stamp.toFixed(0);

    // Rendre les marques et fournisseurs gérés
    this.renderBrandsListSettings();
    this.renderSuppliersListSettings();
  }

  async saveBrand() {
    const brandName = document.getElementById('brand-name-input').value.trim();
    if (!brandName) return;

    try {
      const brands = this.settings['brands'] || [];
      if (brands.some(b => b.name.toLowerCase() === brandName.toLowerCase())) {
        alert("Cette marque existe déjà !");
        return;
      }

      brands.push({ name: brandName, logo: this.currentBrandLogo || '' });
      await db.settings.put({ key: 'brands', value: brands });
      
      // Reset
      document.getElementById('brand-name-input').value = '';
      this.currentBrandLogo = '';
      const logoInput = document.getElementById('brand-logo-input');
      if (logoInput) logoInput.value = '';
      const logoPreviewImg = document.getElementById('brand-logo-preview-img');
      if (logoPreviewImg) {
        logoPreviewImg.src = '';
        logoPreviewImg.style.display = 'none';
      }
      const logoPlaceholderIcon = document.getElementById('brand-logo-placeholder-icon');
      if (logoPlaceholderIcon) logoPlaceholderIcon.style.display = 'block';
      const logoRemoveBtn = document.getElementById('brand-logo-remove-btn');
      if (logoRemoveBtn) logoRemoveBtn.style.display = 'none';

      alert("Marque ajoutée avec succès !");
      await this.loadSettings();
      this.renderBrandsListSettings();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de la marque.");
    }
  }

  async deleteBrand(index) {
    if (!confirm(this.t('g_confirm_delete'))) return;

    try {
      const brands = this.settings['brands'] || [];
      brands.splice(index, 1);
      await db.settings.put({ key: 'brands', value: brands });
      await this.loadSettings();
      this.renderBrandsListSettings();
    } catch (err) {
      console.error(err);
    }
  }

  renderBrandsListSettings() {
    const brandsListContainer = document.getElementById('settings-brands-list');
    if (!brandsListContainer) return;

    const brands = this.settings['brands'] || [];
    if (brands.length === 0) {
      brandsListContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 10px;">Aucune marque enregistrée.</div>`;
      return;
    }

    brandsListContainer.innerHTML = brands.map((b, idx) => `
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding: 8px 12px; border-radius: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--glass-border); overflow: hidden; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); flex-shrink: 0;">
            ${b.logo ? `<img src="${b.logo}" style="width: 100%; height: 100%; object-fit: cover;">` : `
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            `}
          </div>
          <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-light);">${b.name}</span>
        </div>
        <button type="button" class="btn btn-danger btn-icon-only" style="padding: 6px; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;" onclick="window.app.deleteBrand(${idx})">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        </button>
      </div>
    `).join('');
  }

  async saveSupplier() {
    const supplierName = document.getElementById('supplier-name-input').value.trim();
    if (!supplierName) return;

    try {
      const suppliers = this.settings['suppliers'] || [];
      if (suppliers.some(s => s.toLowerCase() === supplierName.toLowerCase())) {
        alert("Ce fournisseur existe déjà !");
        return;
      }

      suppliers.push(supplierName);
      await db.settings.put({ key: 'suppliers', value: suppliers });
      
      // Reset
      document.getElementById('supplier-name-input').value = '';

      alert("Fournisseur ajouté avec succès !");
      await this.loadSettings();
      this.renderSuppliersListSettings();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement du fournisseur.");
    }
  }

  async deleteSupplier(index) {
    if (!confirm(this.t('g_confirm_delete'))) return;

    try {
      const suppliers = this.settings['suppliers'] || [];
      suppliers.splice(index, 1);
      await db.settings.put({ key: 'suppliers', value: suppliers });
      await this.loadSettings();
      this.renderSuppliersListSettings();
    } catch (err) {
      console.error(err);
    }
  }

  renderSuppliersListSettings() {
    const suppliersListContainer = document.getElementById('settings-suppliers-list');
    if (!suppliersListContainer) return;

    const suppliers = this.settings['suppliers'] || [];
    if (suppliers.length === 0) {
      suppliersListContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 10px;">Aucun fournisseur enregistré.</div>`;
      return;
    }

    suppliersListContainer.innerHTML = suppliers.map((s, idx) => `
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding: 8px 12px; border-radius: 8px;">
        <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-light);">${s}</span>
        <button type="button" class="btn btn-danger btn-icon-only" style="padding: 6px; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;" onclick="window.app.deleteSupplier(${idx})">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        </button>
      </div>
    `).join('');
  }

  async saveSettingsForm() {
    const name = document.getElementById('set-name-input').value.trim();
    const phone = document.getElementById('set-phone-input').value.trim();
    const address = document.getElementById('set-address-input').value.trim();
    
    const tvaRaw = document.getElementById('set-tva-input').value;
    const tvaRates = tvaRaw.split(',').map(r => Number(r.trim())).filter(r => !isNaN(r) && r > 0);

    const timbre = Number(document.getElementById('set-stamp-input').value);

    try {
      await db.settings.put({ key: 'boutique_name', value: name });
      await db.settings.put({ key: 'boutique_phone', value: phone });
      await db.settings.put({ key: 'boutique_address', value: address });
      await db.settings.put({ key: 'tva_rates', value: tvaRates });
      await db.settings.put({ key: 'timbre_fiscal', value: timbre });

      alert(this.t('set_saved_success'));
      await this.init(); // recharger la boutique
      this.switchView('dashboard');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement des paramètres.");
    }
  }

  // EXPORTATION DE LA BDD (BACKUP JSON)
  async exportDatabase() {
    try {
      const backup = {
        clients: await db.clients.toArray(),
        products: await db.products.toArray(),
        stock_entries: await db.stock_entries.toArray(),
        invoices: await db.invoices.toArray(),
        caisse: await db.caisse.toArray(),
        settings: await db.settings.toArray()
      };

      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `info_store_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(this.t('set_db_export_success'));
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'exportation de la base de données.");
    }
  }

  // IMPORTATION DE LA BDD (RESTORE JSON)
  async importDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        
        // Validation basique de la structure de sauvegarde
        if (!backup.clients || !backup.products || !backup.settings || !backup.caisse) {
          alert(this.t('set_db_import_error'));
          return;
        }

        // Supprimer toutes les données existantes
        await db.clients.clear();
        await db.products.clear();
        await db.stock_entries.clear();
        await db.invoices.clear();
        await db.caisse.clear();
        await db.settings.clear();

        // Réinjecter les données importées
        await db.clients.bulkAdd(backup.clients);
        await db.products.bulkAdd(backup.products);
        await db.stock_entries.bulkAdd(backup.stock_entries);
        await db.invoices.bulkAdd(backup.invoices);
        await db.caisse.bulkAdd(backup.caisse);
        await db.settings.bulkAdd(backup.settings);

        alert(this.t('set_db_import_success'));
        window.location.reload(); // Recharger complètement l'application pour appliquer
      } catch (err) {
        console.error(err);
        alert(this.t('set_db_import_error'));
      }
    };
    reader.readAsText(file);
  }

  async addCaisseFundsFromSettings() {
    const amountField = document.getElementById('set-cash-amount');
    const descField = document.getElementById('set-cash-desc');
    
    const amount = parseFloat(amountField.value);
    const desc = descField.value.trim();
    
    if (isNaN(amount) || amount <= 0) {
      alert("Veuillez saisir un montant valide supérieur à 0.");
      return;
    }
    
    try {
      const now = new Date().toISOString();
      const currentCaisse = await this.calculateCaisseBalance();
      
      await db.caisse.add({
        date: now,
        amount: amount,
        type: 'cash_in',
        invoiceId: null,
        description: desc || "Alimentation de caisse depuis les paramètres",
        currentTotal: currentCaisse + amount
      });
      
      alert("Caisse alimentée avec succès !");
      document.getElementById('settings-add-cash-form').reset();
      await this.init();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'alimentation de la caisse.");
    }
  }
}

// Lancer l'application globale
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
