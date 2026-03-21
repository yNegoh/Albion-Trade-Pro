const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// CACHE
let cache = { data: [], lastUpdate: 0 };
const CACHE_TIME = 1000 * 60 * 5;

// ITENS
function gerarItens() {
  return [
    "T4_BAG","T5_BAG","T6_BAG",
    "T4_CAPE","T5_CAPE",
    "T4_ORE","T5_ORE","T6_ORE",
    "T4_WOOD","T5_WOOD",
    "T4_STONE","T5_STONE"
  ];
}

// FETCH
async function fetchAllPrices(items) {
  const reqs = items.map(item => {
    return axios.get(`https://www.albion-online-data.com/api/v2/stats/prices/${item}.json`)
      .then(res => ({ item, data: res.data }))
      .catch(() => null);
  });

  const results = await Promise.all(reqs);
  return results.filter(r => r && r.data.length);
}

// VOLUME (simulado)
function getVolume(item){
  if (item.includes("ORE") || item.includes("WOOD") || item.includes("STONE")) {
    return Math.floor(Math.random() * 20000) + 10000;
  }
  if (item.includes("BAG") || item.includes("CAPE")) {
    return Math.floor(Math.random() * 8000) + 2000;
  }
  return Math.floor(Math.random() * 1000);
}

// SCORE
function getScore(lucro, volume){
  return Math.round(lucro * 0.7 + volume * 0.3);
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

      if (lucro <= 0) continue;

      const volume = getVolume(item);
      const score = getScore(lucro, volume);

      ops.push({
        item,
        buyCity: buy.city,
        sellCity: sell.city,
        buyPrice: compra,
        sellPrice: venda,
        lucro: Math.round(lucro),
        volume,
        score
      });
    }
  }

  return ops;
}

// SCANNER (SEM AUTH)
app.get("/scanner", async (req, res) => {

  const now = Date.now();

  if (now - cache.lastUpdate < CACHE_TIME && cache.data.length) {
    return res.json(cache.data);
  }

  const items = gerarItens();
  const allData = await fetchAllPrices(items);

  let resultado = [];

  for (let obj of allData) {
    resultado.push(...calcularFlip(obj.data, obj.item));
  }

  resultado.sort((a,b)=>b.score - a.score);

  cache.data = resultado.slice(0,100);
  cache.lastUpdate = now;

  res.json(cache.data);
});

app.listen(PORT, ()=>console.log("Servidor rodando 🚀"));
