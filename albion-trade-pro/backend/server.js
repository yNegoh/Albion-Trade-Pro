<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Albion Trader Pro</title>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --accent: #22c55e; --dim: #94a3b8; }
        body { background: var(--bg); color: white; font-family: sans-serif; margin: 0; display: flex; height: 100vh; overflow: hidden; }
        .sidebar { width: 240px; background: var(--card); padding: 20px; border-right: 1px solid #334155; }
        .nav-item { display: block; width: 100%; padding: 12px; margin-bottom: 5px; border-radius: 8px; background: transparent; border: none; color: var(--dim); text-align: left; cursor: pointer; font-weight: bold; }
        .nav-item.active { background: #22c55e; color: white; }
        .main { flex: 1; padding: 25px; overflow-y: auto; }
        .page { display: none; }
        .page.active { display: block; }
        .filter-bar { display: flex; gap: 10px; margin-bottom: 20px; background: var(--card); padding: 15px; border-radius: 10px; align-items: center; }
        input { background: #0f172a; color: white; border: 1px solid #334155; padding: 10px; border-radius: 5px; width: 250px; }
        table { width: 100%; border-collapse: collapse; background: var(--card); border-radius: 10px; overflow: hidden; }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid #334155; }
        th { color: #22c55e; font-size: 0.75rem; text-transform: uppercase; }
        .lucro { color: #22c55e; font-weight: bold; }
        .badge-q { padding: 2px 8px; border-radius: 4px; background: #334155; font-size: 0.8rem; color: #fff; }
    </style>
</head>
<body>

    <div class="sidebar">
        <h2 style="color:var(--accent)">Albion Trader</h2>
        <button class="nav-item active" onclick="nav('scanner', this)">📊 Scanner Global</button>
        <button class="nav-item" onclick="nav('top', this)">💎 Top Lucros</button>
        <button class="nav-item" onclick="nav('config', this)">⚙️ Configurações</button>
    </div>

    <div class="main">
        <div id="p-scanner" class="page active">
            <div class="filter-bar">
                <input type="text" id="fNome" placeholder="Filtrar item..." oninput="render()">
                <button onclick="buscar()" style="background:var(--accent); color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold">🔄 ATUALIZAR</button>
            </div>
            <div id="msg" style="margin-bottom:15px; color:var(--accent); font-weight:bold">Aguardando...</div>
            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Rota</th>
                        <th>Compra</th>
                        <th>Venda Líq</th>
                        <th>Lucro</th>
                        <th>ROI</th>
                        <th>Qualidade</th>
                        <th>Visto</th>
                    </tr>
                </thead>
                <tbody id="corpo"></tbody>
            </table>
        </div>

        <div id="p-top" class="page"><h2>💎 Melhores do Momento</h2><div id="top-list"></div></div>
        <div id="p-config" class="page"><h2>⚙️ Configurações</h2><p>Taxa fixada em 6.5% (Premium)</p></div>
    </div>

    <script>
        const API = "https://albion-trade-pro-ogaq.onrender.com/scanner";
        const Q_NOMES = { 1: "Normal", 2: "Bom", 3: "Notável", 4: "Excelente" };
        let dados = [];

        function nav(id, btn) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.getElementById('p-' + id).classList.add('active');
            btn.classList.add('active');
            if(id === 'top') renderTop();
        }

        async function buscar() {
            const m = document.getElementById('msg');
            m.innerText = "⏳ Sincronizando com Albion...";
            try {
                const r = await fetch(API);
                dados = await r.json();
                m.innerText = `✅ ${dados.length} Oportunidades encontradas!`;
                render();
            } catch (e) { m.innerText = "❌ Servidor em manutenção. Tente em 1 min."; }
        }

        function render() {
            const busca = document.getElementById('fNome').value.toLowerCase();
            const corpo = document.getElementById('corpo');
            let html = "";

            dados.filter(d => d.n.toLowerCase().includes(busca)).forEach(d => {
                const tempo = Math.floor((Date.now() - new Date(d.t)) / 60000);
                html += `<tr>
                    <td><b>${d.n}</b></td>
                    <td>${d.o} ➔ ${d.d}</td>
                    <td>${d.c.toLocaleString()}</td>
                    <td>${d.v.toLocaleString()}</td>
                    <td class="lucro">+ ${d.l.toLocaleString()}</td>
                    <td>${d.r}%</td>
                    <td><span class="badge-q">${Q_NOMES[d.q]}</span></td>
                    <td style="color:var(--dim)">${tempo < 0 ? 'Agora' : (tempo < 60 ? tempo+'m' : Math.floor(tempo/60)+'h')}</td>
                </tr>`;
            });
            corpo.innerHTML = html;
        }

        function renderTop() {
            const list = document.getElementById('top-list');
            const tops = [...dados].sort((a,b) => b.r - a.r).slice(0, 5);
            list.innerHTML = tops.length ? tops.map(d => `<div style="background:var(--card); padding:15px; margin-bottom:10px; border-radius:8px; border-left:5px solid var(--accent)"><b>${d.n} (${Q_NOMES[d.q]})</b>: ROI de ${d.r}%</div>`).join('') : "Sem dados.";
        }

        window.onload = buscar;
    </script>
</body>
</html>
