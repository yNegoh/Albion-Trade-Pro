const API = "http://localhost:3000";

async function loadItems() {
  const res = await fetch(API + "/api/items");
  const items = await res.json();

  const search = document.getElementById("search").value.toLowerCase();

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search)
  );

  render(filtered);
}

function render(items) {
  const list = document.getElementById("list");
  list.innerHTML = "";

  items.forEach(item => {
    const li = document.createElement("li");

    li.innerHTML = `
      ${item.name} (T${item.tier})
      <button onclick="fav('${item.code}')">⭐</button>
    `;

    list.appendChild(li);
  });
}

async function fav(code) {
  await fetch(API + "/api/favorites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId: "user1",
      itemCode: code
    })
  });

  alert("Favoritado!");
}
