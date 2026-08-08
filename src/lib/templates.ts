/** The eight customisable message templates, with their shipped defaults. */
export const TEMPLATE_DEFS: {
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
}[] = [
  {
    key: "ORDER_CONFIRMATION",
    name: "Confirmation de commande (Acheteur)",
    subject: "Votre commande {{reference}} est confirmée",
    bodyHtml:
      "<p>Bonjour {{customerName}},</p><p>Votre commande <strong>{{reference}}</strong> d'un montant de <strong>{{total}}</strong> est confirmée.</p><p>Paiement à la livraison — préparez le montant exact.</p>",
    variables: ["customerName", "reference", "total", "storeName"],
  },
  {
    key: "ORDER_STATUS_UPDATE",
    name: "Mise à jour de statut (Acheteur)",
    subject: "Votre commande {{reference}} : {{status}}",
    bodyHtml:
      "<p>Bonjour {{customerName}},</p><p>Le statut de votre commande <strong>{{reference}}</strong> est désormais : <strong>{{status}}</strong>.</p><p>Suivez votre colis : {{trackingUrl}}</p>",
    variables: ["customerName", "reference", "status", "trackingUrl"],
  },
  {
    key: "NEW_ORDER_SELLER",
    name: "Nouvelle commande (Vendeur)",
    subject: "Nouvelle commande {{reference}}",
    bodyHtml:
      "<p>Bonjour {{sellerName}},</p><p>Vous avez reçu une nouvelle commande <strong>{{reference}}</strong> ({{total}}).</p><p>Préparez le colis pour le ramassage.</p>",
    variables: ["sellerName", "reference", "total"],
  },
  {
    key: "DELIVERY_CONFIRMATION",
    name: "Confirmation de livraison (Acheteur)",
    subject: "Votre commande {{reference}} a été livrée",
    bodyHtml:
      "<p>Bonjour {{customerName}},</p><p>Votre commande <strong>{{reference}}</strong> a bien été livrée. Merci de votre confiance !</p><p>Vous avez gagné <strong>{{points}}</strong> points de fidélité.</p>",
    variables: ["customerName", "reference", "points"],
  },
  {
    key: "PAYOUT_NOTIFICATION",
    name: "Notification de virement (Vendeur)",
    subject: "Virement de {{amount}} effectué",
    bodyHtml:
      "<p>Bonjour {{sellerName}},</p><p>Un virement de <strong>{{amount}}</strong> a été effectué vers votre compte {{rib}}.</p>",
    variables: ["sellerName", "amount", "rib"],
  },
  {
    key: "SELLER_APPROVAL",
    name: "Approbation / refus de boutique (Vendeur)",
    subject: "Votre boutique {{storeName}} : {{decision}}",
    bodyHtml:
      "<p>Bonjour {{sellerName}},</p><p>Votre boutique <strong>{{storeName}}</strong> a été <strong>{{decision}}</strong>.</p><p>{{reason}}</p>",
    variables: ["sellerName", "storeName", "decision", "reason"],
  },
  {
    key: "ABANDONED_CART",
    name: "Rappel de panier abandonné (Acheteur)",
    subject: "Vous avez oublié quelque chose 🛒",
    bodyHtml:
      "<p>Bonjour {{customerName}},</p><p>Les articles de votre panier vous attendent toujours. Finalisez votre commande avant rupture de stock.</p>",
    variables: ["customerName", "cartUrl"],
  },
  {
    key: "BIRTHDAY_BONUS",
    name: "Bonus points anniversaire (Acheteur)",
    subject: "Joyeux anniversaire, {{customerName}} 🎉",
    bodyHtml:
      "<p>Bonjour {{customerName}},</p><p>Pour votre anniversaire, nous vous offrons <strong>{{points}}</strong> points de fidélité à utiliser sur votre prochaine commande.</p>",
    variables: ["customerName", "points"],
  },
];
