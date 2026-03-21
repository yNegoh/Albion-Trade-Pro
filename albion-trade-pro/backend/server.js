const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());

const ITEMS = require("./items.json");
let DB = require("./db.json");

// =========================
// UTIL
// =========================

function saveDB() {
  fs.writeFileSync("./db.json", JSON.stringify(DB, null, 2));
}

function getItemByCode(code) {
  return ITEMS.find(i => i.code === code);
}

function getItemName(code) {
  const item = getItemByCode(code);
  return item ? item.name : code;
}

function calcularLucro(buy, sell) {
  const tax = sell * 0.065;
  return sell - buy - tax;
}

// =========================
// ITEMS
// =========================

app.get("/api/items", (req, res) => {
  res.json(ITEMS);
});

// =========================
// PROFIT
// =========================

app.post("/api/profit", (req, res) => {
  const { buy, sell } = req.body;

  const lucro = calcularLucro(buy, sell);
  const roi = ((lucro / buy) * 100).toFixed(2);

  res.json({
    lucro,
    roi
  });
});

// =========================
// FAVORITOS
// =========================

// adicionar favorito
app.post("/api/favorites", (req, res) => {
  const { userId, itemCode } = req.body;

  DB.favorites.push({ userId, itemCode });
  saveDB();

  res.json({ success: true });
});

// listar favoritos
app.get("/api/favorites/:userId", (req, res) => {
  const userId = req.params.userId;

  const favs = DB.favorites
    .filter(f => f.userId === userId)
    .map(f => ({
      ...f,
      name: getItemName(f.itemCode)
    }));

  res.json(favs);
});

// remover favorito
app.delete("/api/favorites", (req, res) => {
  const { userId, itemCode } = req.body;

  DB.favorites = DB.favorites.filter(
    f => !(f.userId === userId && f.itemCode === itemCode)
  );

  saveDB();

  res.json({ success: true });
});

// =========================
// FILTRO AVANÇADO
// =========================

app.get("/api/filter", (req, res) => {
  const { category, tier } = req.query;

  let result = ITEMS;

  if (category) {
    result = result.filter(i => i.category === category);
  }

  if (tier) {
    result = result.filter(i => i.tier == tier);
  }

  res.json(result);
});

// =========================
// START
// =========================

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
