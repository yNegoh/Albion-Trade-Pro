const express = require("express");
const axios = require("axios");
const cors = require("cors");

const ITEMS = require("./items.json");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

let cache = { data: [], lastUpdate: 0 };
const CACHE_TIME = 1000 * 60 * 5;

// CIDADES
const cities = [
  "Bridgewatch","Martlock","Lymhurst",
  "Fort Sterling","Thetford","Caerleon","Black Market"
];

// ITENS
function gerarItens() {
  return ITEMS.map(i => i.code);
}

// DADOS DO ITEM
function getItemData(code){
  return ITEMS.find(i => i.code === code) || {
    name: code,
    category: "Outros"
  };
}

// FETCH API
async function fetchAllPrices(items) {
  const requests = items.map(item =>
    axios.get(`https://www.albion-online-data.com/api/v2/stats/prices/${item}.json`)
      .then(res => ({ item, data: res.data }))
      .catch(() => null)
  );

  const results = await Promise.all(requests);
  return results.filter(r => r && r.data.length);
}

// VOLUME (simulado)
function getVolume(){
  return Math.floor(Math.random() * 10000) + 1000;
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

      const volume = getVolume();
      const score = getScore(lucro, volume);

      const itemData = getItemData(item);

      ops.push({
        item,
        name: itemData.name,
        category: itemData.category,
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

// SCANNER
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

  cache.data = resultado.slice(0,200);
  cache.lastUpdate = now;

  res.json(cache.data);
});

app.listen(PORT, ()=>console.log("Servidor rodando 🚀"));
