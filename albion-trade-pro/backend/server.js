const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

let cache = { data: [], lastUpdate: 0 };
const CACHE_TIME = 1000 * 60 * 10;

// 🔥 TEMPO (3 HORAS)
const TIME_RANGE = 3;

// 🔥 BASE DE ITENS (ALTA DEMANDA)
const BASE_ITEMS = [
  // armas
  "2H_SWORD","BOW","FIRE_STAFF","FROST_STAFF",
  "ARCANE_STAFF","DAGGER","SPEAR","AXE","MACE",

  // armaduras
  "LEATHER_ARMOR","CLOTH_ROBE","PLATE_ARMOR",

  // utilidade
  "CAPE","BAG",

  // recursos
  "ORE","WOOD","STONE","FIBER","HIDE",

  // consumíveis
  "POTION_HEAL","POTION_ENERGY","MEAL_SOUP"
];

// 🔥 NOMES BASE
const NAMES = {
  "2H_SWORD":"Espada Longa",
  "BOW":"Arco",
  "FIRE_STAFF":"Cajado de Fogo",
  "FROST_STAFF":"Cajado de Gelo",
  "ARCANE_STAFF":"Cajado Arcano",
  "DAGGER":"Adaga",
  "SPEAR":"Lança",
  "AXE":"Machado",
  "MACE":"Maça",

  "LEATHER_ARMOR":"Armadura de Couro",
  "CLOTH_ROBE":"Robe de Mago",
  "PLATE_ARMOR":"Armadura de Placa",

  "CAPE":"Capa",
  "BAG":"Bolsa",

  "ORE":"Minério",
  "WOOD":"Madeira",
  "STONE":"Pedra",
  "FIBER":"Fibra",
  "HIDE":"Couro",

  "POTION_HEAL":"Poção de Cura",
  "POTION_ENERGY":"Poção de Energia",
  "MEAL_SOUP":"Sopa"
};

// 🔥 CATEGORIA
const CATEGORY = {
  "2H_SWORD":"Arma","BOW":"Arma","FIRE_STAFF":"Arma","FROST_STAFF":"Arma",
  "ARCANE_STAFF":"Arma","DAGGER":"Arma","SPEAR":"Arma","AXE":"Arma","MACE":"Arma",

  "LEATHER_ARMOR":"Armadura","CLOTH_ROBE":"Armadura","PLATE_ARMOR":"Armadura",

  "CAPE":"Utilidade","BAG":"Utilidade",

  "ORE":"Recurso","WOOD":"Recurso","STONE":"Recurso","FIBER":"Recurso","HIDE":"Recurso",

  "POTION_HEAL":"Consumível","POTION_ENERGY":"Consumível","MEAL_SOUP":"Consumível"
};

// 🔥 GERADOR DE ITENS
function gerarItens(){

  let lista = [];

  for(let tier=4; tier<=8; tier++){
    for(let base of BASE_ITEMS){

      lista.push(`T${tier}_${base}`);
      lista.push(`T${tier}_${base}@1`);
      lista.push(`T${tier}_${base}@2`);
      lista.push(`T${tier}_${base}@3`);
    }
  }

  return lista;
}

// 🔥 NOME BONITO
function getItemData(code){

  const base = code.split("_").slice(1).join("_").split("@")[0];
  const tier = code.match(/T(\d)/)[1];
  const enchant = code.includes("@") ? "." + code.split("@")[1] : "";

  return {
    name: `${NAMES[base] || base} T${tier}${enchant}`,
    category: CATEGORY[base] || "Outros"
  };
}

// FETCH
async function fetchAllPrices(items) {

  const requests = items.map(item =>
    axios.get(`https://www.albion-online-data.com/api/v2/stats/prices/${item}.json?time-scale=${TIME_RANGE}`)
      .then(res => ({ item, data: res.data }))
      .catch(()=>null)
  );

  const results = await Promise.all(requests);
  return results.filter(r=>r && r.data.length);
}

// VOLUME (fake por enquanto)
function getVolume(){
  return Math.floor(Math.random()*10000)+1000;
}

// SCORE
function getScore(lucro, volume){
  return Math.round(lucro*0.6 + volume*0.4);
}

// CALCULO
function calcularFlip(data,item){

  let ops=[];

  for(let buy of data){
    for(let sell of data){

      if(buy.city === sell.city) continue;

      const compra = buy.sell_price_min;
      const venda = sell.buy_price_max;

      if(!compra || !venda) continue;
      if(venda > compra*5) continue;

      const taxa = venda * 0.065;
      const lucro = venda - compra - taxa;

      if(lucro <= 0) continue;

      const volume = getVolume();
      const score = getScore(lucro, volume);

      const info = getItemData(item);

      ops.push({
        item,
        name: info.name,
        category: info.category,
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
app.get("/scanner", async (req,res)=>{

  const now = Date.now();

  if(now - cache.lastUpdate < CACHE_TIME && cache.data.length){
    return res.json(cache.data);
  }

  const items = gerarItens();
  const allData = await fetchAllPrices(items);

  let resultado = [];

  for(let obj of allData){
    resultado.push(...calcularFlip(obj.data,obj.item));
  }

  resultado.sort((a,b)=>b.score - a.score);

  cache.data = resultado.slice(0,1000);
  cache.lastUpdate = now;

  res.json(cache.data);
});

app.listen(PORT, ()=>console.log("Servidor rodando 🚀"));
