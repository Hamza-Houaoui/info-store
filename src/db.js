import Dexie from 'dexie';

// Initialisation de la base de données Dexie
export const db = new Dexie('InfoStoreDB_v2');

// Définition du schéma
db.version(1).stores({
  clients: '++id, name, surname, cin, phone',
  products: '++id, title, brand, supplier, serialNumber, priceSale, priceFactory, tvaRate',
  stock_entries: '++id, productId, quantity, type, date',
  invoices: '++id, invoiceNumber, date, clientName, clientPhone, clientCIN, totalTTC',
  caisse: '++id, date, amount, type, invoiceId',
  settings: 'key'
});

// Fonction pour initialiser les données par défaut (Seeding)
export async function initDefaultData() {
  // 1. Paramètres de la boutique par défaut
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.bulkAdd([
      { key: 'boutique_name', value: 'Info Store' },
      { key: 'boutique_address', value: 'Avenue du 3 Aout 1903, Mohamed Maarouf, Sousse 4000, Tunisie' },
      { key: 'boutique_phone', value: '+216 24 563 441' },
      { key: 'boutique_logo', value: '' }, // Logo SVG/Base64 optionnel
      { key: 'tva_rates', value: [7, 19] }, // Les taux de TVA gérés
      { key: 'timbre_fiscal', value: 1.000 }, // Dinar de timbre fiscal
      { key: 'brands', value: [{ name: 'ASUS', logo: '' }, { name: 'Apple', logo: '' }, { name: 'Razer', logo: '' }] },
      { key: 'suppliers', value: ['ASUS Tunisie', 'iStore Tunisie', 'MyTek Sousse'] }
    ]);
  }

}
