const express = require("express");
const axios = require("axios");
const cors = require("cors");

const ITEMS = require("./items.json");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

let cache = { data: [], lastUpdate: 0 };
const CACHE_TIME = 1000 * 60 * 10; // 10 min cache

// 🔥 TEMPO DE HISTÓRICO (3 HORAS)
const TIME_RANGE = 3; // pode mudar para 24 depois

// ITENS
function gerarItens() {
  return ITEMS.map(i => i.code);
}

// ITEM DATA
function getItemData(code){
  return ITEMS.find(i => i.code === code) || {
    name: code,
    category: "Outros"
  };
}

// FETCH COM TIME RANGE
async function fetchAllPrices(items) {
  const requests = items.map(item =>
    axios.get(`https://www.albion-online-data.com/api/v2/stats/prices/${item}.json?time-scale=${TIME_RANGE}`)
      .then(res => ({ item, data: res.data }))
      .catch(() => null)
  );

  const results = await Promise.all(requests);
  return results.filter(r => r && r.data.length);
}

// VOLUME SIMULADO (depois podemos melhorar)
function getVolume(){
  return Math.floor(Math.random() * 10000) + 1000;
}

// SCORE
function getScore(lucro, volume){
  return Math.round(lucro * 0.6 + volume * 0.4);
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
      if (venda > compra * 5) continue;

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

  cache.data = resultado.slice(0,1000);
  cache.lastUpdate = now;

  res.json(cache.data);
});

app.listen(PORT, ()=>console.log("Servidor rodando 🚀"));
