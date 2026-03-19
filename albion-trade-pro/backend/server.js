const express = require("express");
const axios = require("axios");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SECRET = "albion-secret";

// cidades
const cities = [
  "Bridgewatch",
  "Martlock",
  "Fort Sterling",
  "Lymhurst",
  "Thetford",
  "Caerleon",
  "Brecilien",
  "Black Market"
];

// login fake inicial
app.post("/login", (req, res) => {
  const { username } = req.body;

  const token = jwt.sign(
    { username, plan: "free" },
    SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

// middleware auth
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

// buscar preços
async function fetchPrices(item) {
  const url = `https://www.albion-online-data.com/api/v2/stats/prices/${item}.json`;

  const res = await axios.get(url);
  return res.data;
}

// cálculo lucro
function calcularFlip(data) {
  let oportunidades = [];

  for (let buy of data) {
    for (let sell of data) {
      if (buy.city !== sell.city && buy.sell_price_min > 0 && sell.buy_price_max > 0) {

        const lucro = sell.buy_price_max - buy.sell_price_min;
        const taxa = sell.buy_price_max * 0.065;

        const lucroLiquido = lucro - taxa;

        if (lucroLiquido > 0) {
          oportunidades.push({
            item: buy.item_id,
            buyCity: buy.city,
            sellCity: sell.city,
            buyPrice: buy.sell_price_min,
            sellPrice: sell.buy_price_max,
            lucro: lucroLiquido,
            percentual: (lucroLiquido / buy.sell_price_min) * 100
          });
        }
      }
    }
  }

  return oportunidades.sort((a, b) => b.lucro - a.lucro);
}

// scanner principal
app.get("/scanner", auth, async (req, res) => {

  const items = ["T4_BAG", "T5_BAG", "T6_BAG"]; // depois expandimos

  let resultado = [];

  for (let item of items) {
    try {
      const data = await fetchPrices(item);
      const ops = calcularFlip(data);
      resultado.push(...ops);
    } catch {}
  }

  // regra FREE
  if (req.user.plan === "free") {
    resultado = resultado.filter(op => op.percentual <= 10);
  }

  res.json(resultado.slice(0, 50));
});

app.listen(PORT, () => {
  console.log("Servidor rodando...");
});
