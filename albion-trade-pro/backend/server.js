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

// 🔥 LISTA INTELIGENTE (FIXO + DINÂMICO)
function gerarItens() {

  const itensFixos = [
    "T4_BAG","T5_BAG","T6_BAG",
    "T4_CAPE","T5_CAPE","T6_CAPE",
    "T4_POTION_HEAL","T5_POTION_HEAL","T6_POTION_HEAL",
    "T4_POTION_ENERGY","T5_POTION_ENERGY",
    "T4_FOOD_PIE","T5_FOOD_PIE",
    "T4_ORE","T5_ORE","T6_ORE"
  ];

  const bases = ["WOOD","STONE","FIBER","HIDE"];
  const tiers = [4,5,6];
  const enchants = ["", "@1", "@2"];

  let dinamicos = [];

  for (let tier of tiers) {
    for (let base of bases) {
      for (let ench of enchants) {
        dinamicos.push(`T${tier}_${base}${ench}`);
      }
    }
  }

  return [...itensFixos, ...dinamicos];
}

// FETCH PARALELO
async function fetchAllPrices(items) {

  const requests = items.map(item => {
    const url = `https://www.albion-online-data.com/api/v2/stats/prices/${item}.json`;

    return axios.get(url, { timeout: 5000 })
      .then(res => ({ item, data: res.data }))
      .catch(() => null);
  });

  const results = await Promise.all(requests);
  return results.filter(r => r !== null && r.data.length > 0);
}

// VALIDAÇÃO
function isValidTrade(buy, sell) {

  if (!buy.sell_price_min || !sell.buy_price_max) return false;

  if (buy.sell_price_min <= 0 || sell.buy_price_max <= 0) return false;

  // filtro preço absurdo
  if (sell.buy_price_max > buy.sell_price_min * 10) return false;

  return true;
}

// CALCULO
function calcularFlip(data, item) {

  let oportunidades = [];

  for (let buy of data) {
    for (let sell of data) {

      if (buy.city === sell.city) continue;
      if (!isValidTrade(buy, sell)) continue;

      const compra = buy.sell_price_min;
      const venda = sell.buy_price_max;

      const taxa = venda * 0.065;
      const lucro = venda - compra - taxa;
      const percentual = (lucro / compra) * 100;

      if (lucro <= 0) continue;
      if (percentual > 500) continue;

      oportunidades.push({
        item,
        buyCity: buy.city,
        sellCity: sell.city,
        lucro: Math.round(lucro),
        percentual: percentual.toFixed(2)
      });
    }
  }

  return oportunidades;
}

// SCANNER
app.get("/scanner", auth, async (req, res) => {

  try {

    const items = gerarItens();

    const allData = await fetchAllPrices(items);

    let resultado = [];

    for (let obj of allData) {
      const ops = calcularFlip(obj.data, obj.item);
      resultado.push(...ops);
    }

    resultado.sort((a, b) => b.lucro - a.lucro);

    console.log("TOTAL ENCONTRADO:", resultado.length);

    if (req.user.plan === "free") {
      resultado = resultado.filter(op => op.percentual <= 10);
    }

    res.json(resultado.slice(0, 50));

  } catch (err) {
    console.log(err);
    res.status(500).send("Erro no servidor");
  }
});

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
