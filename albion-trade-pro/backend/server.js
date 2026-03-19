const express = require("express");
const axios = require("axios");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SECRET = "albion-secret";

app.get("/", (req, res) => {
  res.send("Albion Trade Pro API rodando 🚀");
});

// LOGIN
app.post("/login", (req, res) => {
  const { username } = req.body;

  const token = jwt.sign(
    { username, plan: "free" },
    SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

// AUTH
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).send("Sem token");

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).send("Token inválido");
  }
}

// BUSCAR PREÇOS
async function fetchPrices(item) {
  try {
    const url = `https://www.albion-online-data.com/api/v2/stats/prices/${item}.json`;
    const res = await axios.get(url, { timeout: 5000 });
    return res.data;
  } catch {
    return [];
  }
}

// FILTRO INTELIGENTE
function isValidTrade(buy, sell) {

  if (!buy.sell_price_min || !sell.buy_price_max) return false;

  if (buy.sell_price_min <= 0 || sell.buy_price_max <= 0) return false;

  // PREÇO BUGADO
  if (sell.buy_price_max > buy.sell_price_min * 10) return false;

  return true;
}

// CALCULO PROFISSIONAL
function calcularFlip(data, item) {
  let oportunidades = [];

  for (let buy of data) {
    for (let sell of data) {

      if (buy.city === sell.city) continue;

      if (!isValidTrade(buy, sell)) continue;

      const precoCompra = buy.sell_price_min;
      const precoVenda = sell.buy_price_max;

      const taxa = precoVenda * 0.065;
      const lucroBruto = precoVenda - precoCompra;
      const lucroLiquido = lucroBruto - taxa;

      const percentual = (lucroLiquido / precoCompra) * 100;

      // BLOQUEIOS
      if (lucroLiquido <= 0) continue;
      if (percentual > 300) continue;

      oportunidades.push({
        item,
        buyCity: buy.city,
        sellCity: sell.city,
        lucro: Math.round(lucroLiquido),
        percentual: percentual.toFixed(2)
      });
    }
  }

  return oportunidades;
}

// SCANNER
app.get("/scanner", auth, async (req, res) => {

  const items = [
   const items = [

  // BOLSAS E CAPAS
  "T4_BAG","T5_BAG","T6_BAG","T7_BAG",
  "T4_CAPE","T5_CAPE","T6_CAPE","T7_CAPE",

  // COMIDA (ALTÍSSIMO GIRO)
  "T5_FOOD_PIE","T6_FOOD_PIE",
  "T5_FOOD_SALAD","T6_FOOD_SALAD",
  "T5_FOOD_SOUP","T6_FOOD_SOUP",

  // POÇÕES (MUITO FORTE)
  "T4_POTION_HEAL","T5_POTION_HEAL","T6_POTION_HEAL",
  "T4_POTION_ENERGY","T5_POTION_ENERGY","T6_POTION_ENERGY",
  "T4_POTION_REVIVE","T5_POTION_REVIVE","T6_POTION_REVIVE",

  // RECURSOS (SEMPRE VENDEM)
  "T4_STONE","T5_STONE","T6_STONE",
  "T4_WOOD","T5_WOOD","T6_WOOD",
  "T4_FIBER","T5_FIBER","T6_FIBER",
  "T4_HIDE","T5_HIDE","T6_HIDE",
  "T4_ORE","T5_ORE","T6_ORE",

  // REFINADOS
  "T4_PLANKS","T5_PLANKS","T6_PLANKS",
  "T4_METALBAR","T5_METALBAR","T6_METALBAR",
  "T4_LEATHER","T5_LEATHER","T6_LEATHER",
  "T4_CLOTH","T5_CLOTH","T6_CLOTH",
  "T4_STONEBLOCK","T5_STONEBLOCK","T6_STONEBLOCK",

  // MONTARIAS (BOA ROTACAO)
  "T5_MOUNT_HORSE",
  "T6_MOUNT_HORSE",

  // ITENS DE USO GERAL
  "T4_CAPEITEM_FW_BRIDGEWATCH",
  "T4_CAPEITEM_FW_LYMHURST",
  "T4_CAPEITEM_FW_MARTLOCK"
];
  ];

  let resultado = [];

  for (let item of items) {
    const data = await fetchPrices(item);
    const ops = calcularFlip(data, item);
    resultado.push(...ops);
  }

  resultado.sort((a, b) => b.lucro - a.lucro);

  // FREE LIMIT
  if (req.user.plan === "free") {
    resultado = resultado.filter(op => op.percentual <= 10);
  }

  res.json(resultado.slice(0, 50));
});

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
