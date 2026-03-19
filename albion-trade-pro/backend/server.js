const express = require("express");
const axios = require("axios");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SECRET = "albion-secret";

// CACHE
let cache = {
  data: [],
  lastUpdate: 0
};

const CACHE_TIME = 1000 * 60 * 5; // 5 minutos

app.get("/", (req, res) => {
  res.send("Albion Trade Pro API rodando 🚀");
});

// LOGIN
app.post("/login", (req, res) => {
  const token = jwt.sign({ plan: "free" }, SECRET);
  res.json({ token });
});

// AUTH
function auth(req, res, next) {
  try {
    const decoded = jwt.verify(req.headers.authorization, SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).send("Token inválido");
  }
}

// ITENS
function gerarItens() {
  return [
    "T4_BAG","T5_BAG","T6_BAG",
    "T4_CAPE","T5_CAPE","T6_CAPE",
    "T4_POTION_HEAL","T5_POTION_HEAL",
    "T4_FOOD_PIE","T5_FOOD_PIE",
    "T4_ORE","T5_ORE","T6_ORE"
  ];
}

// FETCH
async function fetchAllPrices(items) {
  const requests = items.map(item => {
    const url = `https://www.albion-online-data.com/api/v2/stats/prices/${item}.json`;
    return axios.get(url)
      .then(res => ({ item, data: res.data }))
      .catch(() => null);
  });

  const results = await Promise.all(requests);
  return results.filter(r => r && r.data.length);
}

// CALCULO
function calcularFlip(data, item) {
  let ops = [];

  for (let buy of data) {
    for (let sell of data) {

      if (buy.city === sell.city) continue;

      const compra = buy.sell_price_min;
      const venda = sell.buy_price_max;

      if (!compra || !venda) continue;
      if (venda > compra * 10) continue;

      const taxa = venda * 0.065;
      const lucro = venda - compra - taxa;
      const percentual = (lucro / compra) * 100;

      if (lucro <= 0) continue;

      ops.push({
        item,
        buyCity: buy.city,
        sellCity: sell.city,
        buyPrice: compra,
        sellPrice: venda,
        lucro: Math.round(lucro),
        percentual: percentual.toFixed(2)
      });
    }
  }

  return ops;
}

// SCANNER COM CACHE
app.get("/scanner", auth, async (req, res) => {

  const now = Date.now();

  if (now - cache.lastUpdate < CACHE_TIME && cache.data.length) {
    console.log("USANDO CACHE");
    return res.json(cache.data);
  }

  console.log("ATUALIZANDO DADOS...");

  const items = gerarItens();
  const allData = await fetchAllPrices(items);

  let resultado = [];

  for (let obj of allData) {
    resultado.push(...calcularFlip(obj.data, obj.item));
  }

  resultado.sort((a, b) => b.lucro - a.lucro);

  cache.data = resultado.slice(0, 100);
  cache.lastUpdate = now;

  res.json(cache.data);
});

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
