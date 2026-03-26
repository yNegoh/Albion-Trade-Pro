// ... (mantenha as importações e configurações iniciais)

app.get('/scanner', async (req, res) => {
    const categoria = req.query.cat || 'flip';
    try {
        // ... (mantenha a lógica de filtro de categoria e geração de IDs)

        // Busca na API (Mantenha o sistema de Chunks/Lotes)
        const responses = await Promise.all(promises);
        const dataAPI = responses.flatMap(r => r.data);

        let resultados = [];
        itensFiltrados.forEach(itemBase => {
            [4, 5, 6, 7, 8].forEach(t => {
                ["", "@1", "@2", "@3", "@4"].forEach((v, iEnch) => {
                    const idProd = `T${t}_${itemBase.id}${v}`;
                    const precosProd = dataAPI.filter(p => p.item_id === idProd && p.sell_price_min > 0 && p.quality < 5);

                    precosProd.forEach(venda => {
                        let infoCompra = { custo: 0, cidade: "", msg: "" };
                        
                        // Lógica de Preço de Compra
                        if (categoria === 'flip' || categoria === 'black') {
                            const compra = dataAPI.filter(p => p.item_id === idProd && p.city !== venda.city && p.sell_price_min > 0)
                                                 .sort((a,b) => a.sell_price_min - b.sell_price_min)[0];
                            if (compra) infoCompra = { custo: compra.sell_price_min, cidade: compra.city, msg: "Mercado" };
                        } else {
                            const idMat = idProd.replace(itemBase.id, itemBase.mat);
                            const mat = dataAPI.filter(p => p.item_id === idMat && p.sell_price_min > 0).sort((a,b) => a.sell_price_min - b.sell_price_min)[0];
                            if (mat) infoCompra = { custo: mat.sell_price_min * itemBase.req, cidade: mat.city, msg: `${itemBase.req}x ${itemBase.mat}` };
                        }

                        if (infoCompra.custo > 0) {
                            // --- NOVO FILTRO ANTI-TROLL (v1.4) ---
                            // Se o preço de venda for maior que 4x o custo (Lucro > 300%), ignoramos.
                            if (venda.sell_price_min > (infoCompra.custo * 4)) return; 

                            resultados.push({
                                id: idProd, 
                                tier: t, // Adicionado para facilitar filtro no front
                                n: `${itemBase.name} T${t}${iEnch > 0 ? '.'+iEnch : ''}`,
                                o: infoCompra.cidade, d: venda.city,
                                c_bruto: infoCompra.custo, v_bruto: venda.sell_price_min,
                                details: infoCompra.msg, t: venda.sell_price_min_date, q: venda.quality
                            });
                        }
                    });
                });
            });
        });
        res.json(resultados);
    } catch (e) { res.status(500).json([]); }
});
// ...
