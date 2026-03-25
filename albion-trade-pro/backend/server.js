const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
app.use(cors());
app.use(express.json());

const baseItems = JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8'));

app.get('/scanner', async (req, res) => {
    const categoria = req.query.cat || 'equip';
    try {
        const itensFiltrados = baseItems.filter(i => i.cat === categoria);
        let idsParaBuscar = [];
        let traducoes = {};

        itensFiltrados.forEach(item => {
            [4, 5, 6, 7, 8].forEach(t => {
                const variações = ["", "@1", "@2", "@3"];
                variações.forEach((v, i) => {
                    const id = `T${t}_${item.id}${v}`;
                    idsParaBuscar.push(id);
                    traducoes[id] = `${item.name} T${t}${i > 0 ? '.'+i : ''}`;
                    if (item.mat) idsParaBuscar.push(`T${t}_${item.mat}${v}`);
                });
            });
        });

        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${idsParaBuscar.slice(0, 300).join(',')}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        const response = await axios.get(url);
        const data = response.data;

        let resultados = [];
        itensFiltrados.forEach(itemBase => {
            const idsDesteItem = idsParaBuscar.filter(id => id.includes(itemBase.id));
            
            idsDesteItem.forEach(idProd => {
                const precosProd = data.filter(p => p.item_id === idProd && p.sell_price_min > 0);

                if (categoria === 'equip' || categoria === 'craft') {
                    precosProd.forEach(origem => {
                        precosProd.forEach(destino => {
                            if (origem.city === destino.city) return;
                            const lucroRef = destino.sell_price_min - origem.sell_price_min;
                            if (lucroRef > 1000) {
                                resultados.push({
                                    id: idProd, n: traducoes[idProd], o: origem.city, d: destino.city,
                                    c: origem.sell_price_min, v_bruta: destino.sell_price_min,
                                    t: destino.sell_price_min_date
                                });
                            }
                        });
                    });
                } else if (categoria === 'recurso') {
                    // Lógica de refino simples (Mat -> Produto)
                    const idMat = idProd.replace(itemBase.id, itemBase.mat);
                    const precosMat = data.filter(p => p.item_id === idMat && p.sell_price_min > 0);
                    precosMat.forEach(m => {
                        precosProd.forEach(p => {
                            resultados.push({
                                id: idProd, n: traducoes[idProd], o: `Mat em ${m.city}`, d: `Venda em ${p.city}`,
                                c: m.sell_price_min, v_bruta: p.sell_price_min, t: p.sell_price_min_date
                            });
                        });
                    });
                }
            });
        });

        res.json(resultados.sort((a, b) => b.v_bruta - a.v_bruta).slice(0, 80));
    } catch (e) { res.status(500).json([]); }
});

app.listen(PORT, () => console.log("Motor Pro Ativo"));
