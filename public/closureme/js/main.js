import { openUploadModal } from './characters.js';

const charScroll = document.getElementById("char-scroll");
const sceneScroll = document.getElementById("scene-scroll");
const displayArea = document.querySelector(".display-area");
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        window.location.href = "/auth/html/login.html"; 
    });
}

const imageData = {
  char: { images: [], names: [], memoryDescriptions: [], selected: null, timestamp: null },
  scene: {
    images: Array.from({ length: 5 }, (_, i) => `../../assets/img/scene/${i + 1}.png`),
    descriptions: [
      "海邊落日場景", "森林小徑", "古老圖書館", "現代城市街道", "雪山之巔"
    ],
    selected: null, timestamp: null
  }
};

// ✅ 載入角色資料（只顯示記憶描述）
async function loadCharacters() {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/characters", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("無法載入角色資料");
    const data = await res.json();

    charScroll.innerHTML = "";

    if (data.length === 0) {
      addUploadButton();
      return;
    }

    imageData.char.images = [];
    imageData.char.names = [];
    imageData.char.memoryDescriptions = [];

    for (let i = 0; i < data.length; i++) {
      const char = data[i];

      // ✅ 建立卡片
      const card = createCard("char", i, char.image_path);
      charScroll.appendChild(card);

      // ✅ 存放資料
      imageData.char.images.push(char.image_path);
      imageData.char.names.push(char.name);

      // ✅ 讀取記憶描述
      const memoryText = await loadTextFile(char.memory_path);
      imageData.char.memoryDescriptions.push(memoryText);
    }

    document.getElementById("char-count").textContent = `0/${imageData.char.images.length}`;
    addUploadButton();
  } catch (err) {
    console.error("角色載入錯誤:", err);
    charScroll.innerHTML = "<p style='color:red;'>無法載入角色資料</p>";
    addUploadButton();
  }
}

// ✅ 載入文字檔
async function loadTextFile(url) {
  if (!url) return "描述檔案不存在";
  try {
    const res = await fetch(url);
    if (!res.ok) return "描述讀取失敗";
    return await res.text();
  } catch {
    return "描述載入錯誤";
  }
}

// ✅ 建立角色或場景卡片
function createCard(type, index, imageUrl) {
  const card = document.createElement("div");
  card.classList.add("select-card");
  card.dataset.type = type;
  card.dataset.index = index;

  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = `${type}-${index + 1}`;
  card.appendChild(img);

  card.onclick = () => handleSelect(card);
  return card;
}

// ✅ 點擊選擇卡片
function handleSelect(card) {
  const type = card.dataset.type;
  const index = parseInt(card.dataset.index);

  document.querySelectorAll(`.select-card[data-type='${type}']`).forEach(c => c.classList.remove("selected"));
  card.classList.add("selected");

  imageData[type].selected = index;
  imageData[type].timestamp = Date.now();

  updateCount(type);
  updateDisplay();
}

// ✅ 更新顯示翻轉卡片
function updateDisplay() {
  displayArea.innerHTML = "";

  const charTime = imageData.char.timestamp || 0;
  const sceneTime = imageData.scene.timestamp || 0;
  const lastType = charTime > sceneTime ? "char" : "scene";
  const lastIndex = imageData[lastType].selected;
  if (lastIndex === null) return;

  const src = imageData[lastType].images[lastIndex];
  const name = imageData[lastType].names ? imageData[lastType].names[lastIndex] : `${lastType} ${lastIndex + 1}`;
  const memoryDesc = lastType === "char" ? imageData.char.memoryDescriptions[lastIndex] : imageData.scene.descriptions[lastIndex];

  const shortDesc = memoryDesc.length > 100 ? memoryDesc.substring(0, 100) + "..." : memoryDesc;

  // ✅ 保持原有翻轉結構
  const flipContainer = document.createElement("div");
  flipContainer.className = "flip-container";

  const flipCard = document.createElement("div");
  flipCard.className = "flip-card";

  // 正面
  const cardFront = document.createElement("div");
  cardFront.className = "card-face card-front";

  const bg = document.createElement("img");
  bg.className = "bg-blur";
  bg.src = src;

  const fg = document.createElement("img");
  fg.className = "fg-image";
  fg.src = src;

  cardFront.appendChild(bg);
  cardFront.appendChild(fg);

  // 背面
  const cardBack = document.createElement("div");
  cardBack.className = "card-face card-back";

  const blur = document.createElement("div");
  blur.className = "blur-background";
  blur.style.backgroundImage = `url(${src})`;

  const content = document.createElement("div");
  content.className = "back-content";

  const title = document.createElement("h2");
  title.textContent = name;

  const desc = document.createElement("p");
  desc.textContent = shortDesc;

  content.appendChild(title);
  content.appendChild(desc);

  if (lastType === "char") {
    const moreBtn = document.createElement("button");
    moreBtn.textContent = "查看完整記憶";
    moreBtn.className = "view-more-btn";
    moreBtn.onclick = () => openDescriptionModal(memoryDesc);
    content.appendChild(moreBtn);
  }

  cardBack.appendChild(blur);
  cardBack.appendChild(content);

  flipCard.appendChild(cardFront);
  flipCard.appendChild(cardBack);
  flipContainer.appendChild(flipCard);
  displayArea.appendChild(flipContainer);

  flipContainer.onclick = () => flipCard.classList.toggle("flipped");
}

// ✅ 模態視窗
function openDescriptionModal(fullText) {
  const modal = document.getElementById("descModal");
  const closeBtn = modal.querySelector(".close-btn");
  const textEl = document.getElementById("descFullText");

  textEl.textContent = fullText;
  modal.style.display = "flex";

  closeBtn.onclick = () => modal.style.display = "none";
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
}

// ✅ 工具
function updateCount(type) {
  const countEl = document.getElementById(`${type}-count`);
  const total = imageData[type].images.length;
  countEl.textContent = `${imageData[type].selected !== null ? 1 : 0}/${total}`;
}

function addUploadButton() {
  const addCard = document.createElement("a");
  addCard.className = "add-card";
  addCard.textContent = "+";
  charScroll.appendChild(addCard);
  addCard.onclick = (e) => { e.preventDefault(); openUploadModal(); };
}

// ✅ 初始化場景卡片
function initSceneCards() {
  sceneScroll.innerHTML = "";
  imageData.scene.images.forEach((url, index) => {
    sceneScroll.appendChild(createCard("scene", index, url));
  });

  const addCard = document.createElement("a");
  addCard.className = "add-card";
  addCard.textContent = "+";
  sceneScroll.appendChild(addCard);

  addCard.onclick = (e) => { e.preventDefault(); showToast("目前僅開放人物上傳功能", "error"); };

  document.getElementById("scene-count").textContent = `0/${imageData.scene.images.length}`;
}

// ✅ 初始化
loadCharacters();
initSceneCards();




