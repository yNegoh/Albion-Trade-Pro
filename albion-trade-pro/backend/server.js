const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// 🔐 LOGIN
const USERS = {
  "negoh": {
    password: "301309*Negoh",
    premium: true
  }
};

app.post("/login", (req,res)=>{
  const {user, pass} = req.body;

  if(USERS[user] && USERS[user].password === pass){
    return res.json({ success:true, premium:true });
  }

  res.json({ success:false });
});

// CACHE
let cache = { data: [], lastUpdate: 0 };
const CACHE_TIME = 1000 * 60 * 10;

// 🔥 MAIS DADOS
const TIME_RANGE = 24;

// 🔥 BASE REALISTA
const BASE_ITEMS = [
  "2H_SWORD","BOW","FIRE_STAFF","FROST_STAFF",
  "ARCANE_STAFF","DAGGER","SPEAR","AXE","MACE",

  "LEATHER_ARMOR","CLOTH_ROBE","PLATE_ARMOR",

  "CAPE","BAG",

  "PLANKS","METALBAR","LEATHER","CLOTH","STONEBLOCK",

  "POTION_HEAL","POTION_ENERGY","MEAL_SOUP"
];

// GERAR ITENS (CORRETO)
function gerarItens(){

  let lista = [];

  for(let t=4; t<=8; t++){
    BASE_ITEMS.forEach(base=>{

      lista.push(`T${t}_${base}`);

      for(let e=1; e<=3; e++){
        lista.push(`T${t}_${base}_LEVEL${e}@${e}`);
      }

    });
  }

  return lista;
}

// NOME FORMATADO
function nomeItem(code){

  const tier = code.match(/T(\d)/)[1];

  const enchantMatch = code.match(/@(\d)/);
  const enchant = enchantMatch ? "." + enchantMatch[1] : "";

  const base = code
    .replace(`T${tier}_`, "")
    .replace(/_LEVEL\d@/, "")
    .replace(/@.*/, "")
    .replaceAll("_"," ");

  return `${base} T${tier}${enchant}`;
}

// FETCH
async function fetchAll(items){

  const reqs = items.map(i =>
    axios.get(`https://www.albion-online-data.com/api/v2/stats/prices/${i}.json?time-scale=${TIME_RANGE}`)
    .then(r=>({item:i,data:r.data}))
    .catch(()=>null)
  );

  const res = await Promise.all(reqs);
  return res.filter(r=>r && r.data.length);
}

// CALCULO
function calcular(data,item){

  let ops=[];

  for(let a of data){
    for(let b of data){

      if(a.city === b.city) continue;

      const compra = a.sell_price_min;
      const venda = b.buy_price_max;

      if(!compra || !venda) continue;

      const taxa = venda * 0.065;
      const lucro = venda - compra - taxa;

      const volume = Math.floor(Math.random()*5000)+500;
      const score = lucro + volume;

      ops.push({
        item,
        name: nomeItem(item),
        category: item.split("_")[1],
        buyCity: a.city,
        sellCity: b.city,
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
  const data = await fetchAll(items);

  let result=[];

  for(let d of data){
    result.push(...calcular(d.data,d.item));
  }

  result.sort((a,b)=>b.score - a.score);

  cache.data = result.slice(0,1000);
  cache.lastUpdate = now;

  res.json(cache.data);
});

app.listen(PORT, ()=>console.log("Servidor rodando 🚀"));
