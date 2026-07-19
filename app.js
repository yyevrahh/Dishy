import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDvXage0SbYUMV8RFZzn48ANw4GX_D6Zfo",
  authDomain: "dishy-280a7.firebaseapp.com",
  projectId: "dishy-280a7",
  storageBucket: "dishy-280a7.firebasestorage.app",
  messagingSenderId: "785622443437",
  appId: "1:785622443437:web:acbe9c5813fb60be0c2d24",
  measurementId: "G-N3X5D4SQ58"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// App-wide state
let currentUser = null;
let userId = null;
let savedRecipes = [];
let pantryIngredients = []; // Stores objects: { id: "...", name: "..." }
let currentRecipe = null; // Focused recipe for the main viewer
let sidebarExpanded = false;
let activeSidebarTab = "recipes"; // Can be 'recipes' or 'pantry'
let sidebarSearchQuery = "";

// Cooking Step-by-Step wizard state
let cookingSteps = [];
let currentStepIndex = 0;

// Filter selections for bottom chat bar
let selectedIngredients = "";
let selectedFlavor = "";
let selectedPersonCount = "";

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  // Check auth state
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      userId = user.uid;
      console.log("User logged in:", user.displayName);
      
      // Load user data
      await loadPantryIngredients();
      await loadSavedRecipes();
      
      // Render Dashboard
      renderDashboard();
    } else {
      currentUser = null;
      userId = null;
      savedRecipes = [];
      pantryIngredients = [];
      currentRecipe = null;
      
      // Render Login Screen
      renderLoginScreen();
    }
  });

  // Handle Saved / Deleted popup OK buttons
  document.addEventListener("click", (e) => {
    if (e.target.id === "closePopup") {
      document.getElementById("saved").style.display = "none";
    }
    if (e.target.id === "closePopup2") {
      document.getElementById("deleted").style.display = "none";
    }
  });
});

// Render Login Screen
function renderLoginScreen() {
  const root = document.getElementById("app-root");
  root.innerHTML = `
    <div class="content login-page">
        <div class="preview">
            <h2 class="title">Generate recipes on the go.</h2>
            <p class="description">Try Dishy! <br>Type in your ingredients and see what dishes you can make from scratch!</p>
        </div>

        <div class="get-started">
            <h1 class="start">Get started!</h1>
            <h3 id="google-sign-in">Sign in or sign up with <img class="google_logo" src="res/google_logo.png" alt="Google"></h3>
        </div>

        <div class="whats-dishy">
            <div class="what-info">
                <h1>What's Dishy!?</h1>
                <p>Dishy! is a clever culinary tool that helps you turn your pantry into a gourmet kitchen. By simply inputting the ingredients you have on hand, Dishy! generates a variety of recipe ideas tailored to your specific supplies. Dishy! takes the guesswork out of meal planning, empowering you to create delicious dishes from what you already have, reducing food waste and inspiring culinary creativity.</p>
            </div>
            <div class="omelet"></div>
        </div>

        <div class="whats-dishy marginned">
            <div class="database"></div>
            <div class="what-info right">
                <h1>How does Dishy! work?</h1>
                <p>Dishy! leverages a sophisticated algorithm to analyze the ingredients you input. It cross-references this information, identifying potential dishes that align with your available ingredients. The algorithm considers factors like flavor preferences, cuisine types, and cooking skill levels to provide personalized recipe suggestions. By intelligently matching your ingredients to suitable recipes, Dishy! helps you make the most of your culinary resources.</p>
            </div>
        </div>
    </div>
  `;

  // Attach login event
  document.getElementById("google-sign-in").addEventListener("click", () => {
    signInWithPopup(auth, provider)
      .then((result) => {
        console.log("Signed in successfully:", result.user.displayName);
      })
      .catch((error) => {
        console.error("Error signing in:", error);
      });
  });
}

// Render Dashboard View (Single Page Dashboard)
function renderDashboard() {
  const root = document.getElementById("app-root");
  
  root.innerHTML = `
    <div class="dashboard-container">
      
      <!-- Left side Navigation section -->
      <div class="sidebar ${sidebarExpanded ? 'expanded' : 'collapsed'}" id="sidebar">
        <div class="sidebar-top">
          <!-- Dishy Logo acts as expand/collapse toggle -->
          <div class="dishy-logo-btn" id="sidebar-toggle" title="Toggle Sidebar">
            <img src="res/dishy_icon.png" alt="Dishy Logo" class="logo-icon">
            <span class="logo-text">Dishy</span>
          </div>

          <!-- Search Query Input at top of expanded sidebar -->
          <div class="search-container" style="${sidebarExpanded ? '' : 'display: none;'}">
            <input type="text" id="sidebar-search-input" value="${sidebarSearchQuery}" placeholder="Search pantry & recipes...">
          </div>
        </div>

        <!-- Navigation Tabs/Icons -->
        <div class="sidebar-nav">
          <button class="nav-tab-btn ${activeSidebarTab === 'recipes' ? 'active' : ''}" id="tab-recipes" title="Saved Recipes">
            <span class="tab-icon">📖</span>
            <span class="tab-text">Saved Recipes</span>
          </button>
          <button class="nav-tab-btn ${activeSidebarTab === 'pantry' ? 'active' : ''}" id="tab-pantry" title="Pantry Setup">
            <span class="tab-icon">🍎</span>
            <span class="tab-text">Pantry Setup</span>
          </button>
        </div>

        <!-- List Content Area (Pantry or Saved Recipes) -->
        <div class="sidebar-list-container" style="${sidebarExpanded ? '' : 'display: none;'}">
          <div id="sidebar-list-content">
            <!-- Dynamically populated -->
          </div>
        </div>

        <!-- Logout button at the bottom of sidebar -->
        <div class="sidebar-footer">
          <button id="dashboard-logout-btn" class="logout-btn" title="Logout">
            <span class="tab-icon">🚪</span>
            <span class="tab-text">Logout</span>
          </button>
        </div>
      </div>

      <!-- Center / Main Content Panel -->
      <div class="main-content">
        
        <!-- Center Focus Recipe Viewer -->
        <div class="recipe-viewer" id="recipe-viewer-area">
          <!-- Dynamically Populated -->
        </div>

        <!-- AI Chat and Filter Input Bar (Bottom of screen) -->
        <div class="chat-bar-container">
          <div class="chat-bar-inputs">
            
            <!-- Three filter parameters on the left -->
            <div class="filter-buttons">
              <!-- Add ingredients filter -->
              <div class="filter-dropdown-container">
                <button class="filter-btn ${selectedIngredients ? 'has-value' : ''}" id="btn-filter-ingredients" title="Add Ingredients to use">
                  🥕 <span class="filter-badge">${selectedIngredients ? '•' : ''}</span>
                </button>
                <div class="filter-popover" id="popover-ingredients">
                  <h4>Ingredients to use:</h4>
                  <input type="text" id="filter-ingredients-input" value="${selectedIngredients}" placeholder="e.g. Chicken, onions, garlic">
                  <button class="popover-close-btn">Set</button>
                </div>
              </div>

              <!-- Choose flavor filter -->
              <div class="filter-dropdown-container">
                <button class="filter-btn ${selectedFlavor ? 'has-value' : ''}" id="btn-filter-flavor" title="Choose Flavor">
                  🌶️ <span class="filter-badge">${selectedFlavor ? '•' : ''}</span>
                </button>
                <div class="filter-popover" id="popover-flavor">
                  <h4>Choose Flavor:</h4>
                  <select id="filter-flavor-input">
                    <option value="" ${selectedFlavor === '' ? 'selected' : ''}>Any Flavor</option>
                    <option value="Spicy" ${selectedFlavor === 'Spicy' ? 'selected' : ''}>Spicy</option>
                    <option value="Sweet" ${selectedFlavor === 'Sweet' ? 'selected' : ''}>Sweet</option>
                    <option value="Savory" ${selectedFlavor === 'Savory' ? 'selected' : ''}>Savory</option>
                    <option value="Sour" ${selectedFlavor === 'Sour' ? 'selected' : ''}>Sour</option>
                    <option value="Salty" ${selectedFlavor === 'Salty' ? 'selected' : ''}>Salty</option>
                  </select>
                  <button class="popover-close-btn">Set</button>
                </div>
              </div>

              <!-- How many person will eat filter -->
              <div class="filter-dropdown-container">
                <button class="filter-btn ${selectedPersonCount ? 'has-value' : ''}" id="btn-filter-persons" title="How many persons will eat">
                  👥 <span class="filter-badge">${selectedPersonCount ? '•' : ''}</span>
                </button>
                <div class="filter-popover" id="popover-persons">
                  <h4>How many persons will eat:</h4>
                  <input type="text" id="filter-persons-input" value="${selectedPersonCount}" placeholder="e.g. 3 people">
                  <button class="popover-close-btn">Set</button>
                </div>
              </div>
            </div>

            <!-- Chat input bar -->
            <input type="text" id="chat-bar-input" placeholder="Describe what recipe you want...">
            
            <!-- Send button -->
            <button id="chat-bar-send-btn" class="chat-send-btn">Send</button>
          </div>
        </div>

      </div>

      <!-- Cooking Step-by-Step Overlay Wizard -->
      <div class="cooking-overlay" id="cooking-step-overlay" style="display: none;">
        <div class="cooking-card">
          <div class="cooking-header">
            <h3>Cooking: <span id="cooking-dish-name"></span></h3>
            <button id="close-cooking-btn" class="cooking-close-x">&times;</button>
          </div>
          <div class="cooking-body">
            <p class="cooking-progress-indicator">Step <span id="current-step-num">1</span> of <span id="total-step-num">1</span></p>
            <div class="cooking-step-text-container">
              <h2 id="cooking-step-text">Procedure text here...</h2>
            </div>
          </div>
          <div class="cooking-footer">
            <button id="cooking-prev-btn" class="cooking-nav-btn">Back</button>
            <button id="cooking-next-btn" class="cooking-nav-btn primary">Next</button>
          </div>
        </div>
      </div>

    </div>
  `;

  // Bind Sidebar events
  const sidebarToggle = document.getElementById("sidebar-toggle");
  sidebarToggle.addEventListener("click", () => {
    sidebarExpanded = !sidebarExpanded;
    renderDashboard();
  });

  const searchInput = document.getElementById("sidebar-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      sidebarSearchQuery = e.target.value;
      populateSidebarList();
    });
  }

  const tabRecipes = document.getElementById("tab-recipes");
  tabRecipes.addEventListener("click", () => {
    activeSidebarTab = "recipes";
    populateSidebarList();
    // Highlight active
    document.getElementById("tab-recipes").classList.add("active");
    document.getElementById("tab-pantry").classList.remove("active");
  });

  const tabPantry = document.getElementById("tab-pantry");
  tabPantry.addEventListener("click", () => {
    activeSidebarTab = "pantry";
    populateSidebarList();
    // Highlight active
    document.getElementById("tab-recipes").classList.remove("active");
    document.getElementById("tab-pantry").classList.add("active");
  });

  // Bind Logout Button
  document.getElementById("dashboard-logout-btn").addEventListener("click", () => {
    signOut(auth);
  });

  // Populate Sidebar content
  populateSidebarList();

  // Populate Recipe Viewer
  updateRecipeViewer();

  // Setup bottom chat bar parameter popovers and send action
  setupChatBarHandlers();

  // Setup Cooking step-by-step navigation
  setupCookingHandlers();
}

// Populate the Sidebar lists with filtering/search query
function populateSidebarList() {
  const listContent = document.getElementById("sidebar-list-content");
  if (!listContent) return;

  listContent.innerHTML = "";
  const queryLower = sidebarSearchQuery.toLowerCase();

  if (sidebarSearchQuery !== "") {
    // Search between BOTH pantry and saved recipes
    const matchingRecipes = savedRecipes.filter(r => r.dishName.toLowerCase().includes(queryLower));
    const matchingPantry = pantryIngredients.filter(p => p.name.toLowerCase().includes(queryLower));

    listContent.innerHTML = `
      <div class="search-section-title">Matching Saved Recipes</div>
      <div class="search-results-list" id="matching-recipes-list"></div>
      <div class="search-section-title" style="margin-top: 15px;">Matching Pantry Items</div>
      <div class="search-results-list" id="matching-pantry-list"></div>
    `;

    const rList = document.getElementById("matching-recipes-list");
    if (matchingRecipes.length === 0) {
      rList.innerHTML = `<div class="empty-list-info">No recipes found.</div>`;
    } else {
      matchingRecipes.forEach(recipe => {
        const item = document.createElement("div");
        item.className = "sidebar-item recipe-item";
        item.innerHTML = `
          <span class="item-name">${recipe.dishName}</span>
          <button class="delete-item-btn" data-id="${recipe.id}">&times;</button>
        `;
        item.addEventListener("click", (e) => {
          if (!e.target.classList.contains("delete-item-btn")) {
            currentRecipe = recipe;
            updateRecipeViewer();
          }
        });
        rList.appendChild(item);
      });
    }

    const pList = document.getElementById("matching-pantry-list");
    if (matchingPantry.length === 0) {
      pList.innerHTML = `<div class="empty-list-info">No ingredients found.</div>`;
    } else {
      matchingPantry.forEach(ing => {
        const item = document.createElement("div");
        item.className = "sidebar-item pantry-item";
        item.innerHTML = `
          <span class="item-name">${ing.name}</span>
          <button class="delete-item-btn" data-id="${ing.id}">&times;</button>
        `;
        pList.appendChild(item);
      });
    }

    // Attach deletes
    listContent.querySelectorAll(".delete-item-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (btn.closest(".recipe-item")) {
          await deleteRecipe(id);
        } else {
          await deletePantryIngredient(id);
        }
      });
    });

  } else {
    // Normal Tab-based lists
    if (activeSidebarTab === "recipes") {
      if (savedRecipes.length === 0) {
        listContent.innerHTML = `<div class="empty-list-info">No saved recipes. Generate one and save it!</div>`;
      } else {
        savedRecipes.forEach(recipe => {
          const item = document.createElement("div");
          item.className = "sidebar-item recipe-item";
          item.innerHTML = `
            <span class="item-name">${recipe.dishName}</span>
            <button class="delete-item-btn" data-id="${recipe.id}">&times;</button>
          `;
          item.addEventListener("click", (e) => {
            if (!e.target.classList.contains("delete-item-btn")) {
              currentRecipe = recipe;
              updateRecipeViewer();
            }
          });
          listContent.appendChild(item);
        });
      }
    } else {
      // Pantry list with Add input
      const addContainer = document.createElement("div");
      addContainer.className = "pantry-add-form";
      addContainer.innerHTML = `
        <input type="text" id="pantry-item-input" placeholder="Add pantry item...">
        <button id="add-pantry-item-btn">+</button>
      `;
      listContent.appendChild(addContainer);

      const pListContainer = document.createElement("div");
      pListContainer.className = "pantry-list-scroll";
      listContent.appendChild(pListContainer);

      if (pantryIngredients.length === 0) {
        pListContainer.innerHTML = `<div class="empty-list-info">Your pantry is empty. Add ingredients you have on hand!</div>`;
      } else {
        pantryIngredients.forEach(ing => {
          const item = document.createElement("div");
          item.className = "sidebar-item pantry-item";
          item.innerHTML = `
            <span class="item-name">${ing.name}</span>
            <button class="delete-item-btn" data-id="${ing.id}">&times;</button>
          `;
          pListContainer.appendChild(item);
        });
      }

      // Bind Pantry events
      const pInput = document.getElementById("pantry-item-input");
      const pAddBtn = document.getElementById("add-pantry-item-btn");

      const handleAddPantry = async () => {
        const val = pInput.value.trim();
        if (val) {
          await addPantryIngredient(val);
          pInput.value = "";
        }
      };

      pAddBtn.addEventListener("click", handleAddPantry);
      pInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleAddPantry();
      });
    }

    // Attach deletes
    listContent.querySelectorAll(".delete-item-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (activeSidebarTab === "recipes") {
          await deleteRecipe(id);
        } else {
          await deletePantryIngredient(id);
        }
      });
    });
  }
}

// Setup Popover menus for chat filters and sending chats
function setupChatBarHandlers() {
  const popovers = ["ingredients", "flavor", "persons"];

  popovers.forEach(name => {
    const btn = document.getElementById(`btn-filter-${name}`);
    const popover = document.getElementById(`popover-${name}`);
    
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close others
      popovers.forEach(o => {
        if (o !== name) document.getElementById(`popover-${o}`).classList.remove("open");
      });
      popover.classList.toggle("open");
    });

    const closeBtn = popover.querySelector(".popover-close-btn");
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      popover.classList.remove("open");
      updateFilterSelections();
    });
  });

  // Clicking outside popovers closes them
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".filter-dropdown-container")) {
      popovers.forEach(name => {
        document.getElementById(`popover-${name}`).classList.remove("open");
      });
    }
  });

  // Send action
  const sendBtn = document.getElementById("chat-bar-send-btn");
  const chatInput = document.getElementById("chat-bar-input");

  const triggerGenerate = async () => {
    const promptText = chatInput.value.trim();
    chatInput.value = "";
    await generateOrUpdateRecipe(promptText);
  };

  sendBtn.addEventListener("click", triggerGenerate);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") triggerGenerate();
  });
}

function updateFilterSelections() {
  selectedIngredients = document.getElementById("filter-ingredients-input").value.trim();
  selectedFlavor = document.getElementById("filter-flavor-input").value;
  selectedPersonCount = document.getElementById("filter-persons-input").value.trim();

  // Update badge classes
  const ingBtn = document.getElementById("btn-filter-ingredients");
  if (selectedIngredients) ingBtn.classList.add("has-value");
  else ingBtn.classList.remove("has-value");

  const flavBtn = document.getElementById("btn-filter-flavor");
  if (selectedFlavor) flavBtn.classList.add("has-value");
  else flavBtn.classList.remove("has-value");

  const persBtn = document.getElementById("btn-filter-persons");
  if (selectedPersonCount) persBtn.classList.add("has-value");
  else persBtn.classList.remove("has-value");
}

// Update Center Recipe Viewer content
function updateRecipeViewer() {
  const viewer = document.getElementById("recipe-viewer-area");
  if (!viewer) return;

  if (!currentRecipe) {
    viewer.innerHTML = `
      <div class="viewer-welcome">
        <h1>Welcome to Dishy!</h1>
        <p>Your ultimate single-page smart AI chef.</p>
        <p>Use the chat bar at the bottom of the screen to describe what recipe you want, choose your filters, or select a saved recipe from the sidebar to begin.</p>
        <div class="welcome-suggested-pantry">
          <h3>Pantry Ingredients available:</h3>
          <p>${pantryIngredients.length > 0 ? pantryIngredients.map(p => p.name).join(", ") : "Your pantry is currently empty. Use the sidebar 'Pantry Setup' tab to add items!"}</p>
        </div>
      </div>
    `;
    return;
  }

  // Display focused recipe
  viewer.innerHTML = `
    <div class="recipe-focused">
      <!-- Top right actions -->
      <div class="recipe-focused-actions">
        <button id="action-save-recipe" class="recipe-action-btn" title="Save this recipe">💾 Save Recipe</button>
        <button id="action-start-cooking" class="recipe-action-btn primary" title="Start cooking">🍳 Start Cooking</button>
      </div>

      <!-- Recipe Contents -->
      <div class="recipe-header">
        <h1 class="recipe-title">${currentRecipe.dishName}</h1>
        <div class="recipe-subtitle">
          <span class="subtitle-tag">🌶️ ${currentRecipe.flavor || "Flavor details"}</span>
          <span class="subtitle-tag">👥 ${currentRecipe.goodFor || "Good for several people"}</span>
          <span class="subtitle-tag">👨‍🍳 ${currentRecipe.difficulty || "medium"}</span>
        </div>
      </div>

      <div class="recipe-details-grid">
        <div class="recipe-ingredients-section">
          <h3>Ingredients</h3>
          <ul>
            ${currentRecipe.ingredients.map(ing => `<li>${ing}</li>`).join("")}
          </ul>
        </div>

        <div class="recipe-instructions-section">
          <h3>Instructions</h3>
          <ol>
            ${currentRecipe.procedures.map(proc => `<li>${proc}</li>`).join("")}
          </ol>
        </div>
      </div>
    </div>
  `;

  // Bind Recipe actions
  document.getElementById("action-save-recipe").addEventListener("click", () => {
    saveRecipe(currentRecipe);
  });

  document.getElementById("action-start-cooking").addEventListener("click", () => {
    startCookingMode(currentRecipe);
  });
}

// Cooking step-by-step overlays
function setupCookingHandlers() {
  const overlay = document.getElementById("cooking-step-overlay");
  const closeBtn = document.getElementById("close-cooking-btn");
  const prevBtn = document.getElementById("cooking-prev-btn");
  const nextBtn = document.getElementById("cooking-next-btn");

  closeBtn.addEventListener("click", () => {
    overlay.style.display = "none";
  });

  prevBtn.addEventListener("click", () => {
    if (currentStepIndex > 0) {
      currentStepIndex--;
      showCurrentStep();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentStepIndex < cookingSteps.length - 1) {
      currentStepIndex++;
      showCurrentStep();
    } else {
      // Done cooking
      overlay.style.display = "none";
      alert("Enjoy your meal! You finished cooking!");
    }
  });
}

function startCookingMode(recipe) {
  cookingSteps = recipe.procedures;
  currentStepIndex = 0;
  
  document.getElementById("cooking-dish-name").textContent = recipe.dishName;
  document.getElementById("cooking-step-overlay").style.display = "flex";
  
  showCurrentStep();
}

function showCurrentStep() {
  const stepText = document.getElementById("cooking-step-text");
  const stepNum = document.getElementById("current-step-num");
  const totalNum = document.getElementById("total-step-num");
  const prevBtn = document.getElementById("cooking-prev-btn");
  const nextBtn = document.getElementById("cooking-next-btn");

  stepText.textContent = cookingSteps[currentStepIndex];
  stepNum.textContent = currentStepIndex + 1;
  totalNum.textContent = cookingSteps.length;

  if (currentStepIndex === 0) {
    prevBtn.style.display = "none";
  } else {
    prevBtn.style.display = "inline-block";
  }

  if (currentStepIndex === cookingSteps.length - 1) {
    nextBtn.textContent = "Finish Cooking";
  } else {
    nextBtn.textContent = "Next";
  }
}

// Generate or Update Recipe using API
async function generateOrUpdateRecipe(chatPrompt) {
  const loader = document.querySelector(".loader");
  if (loader) loader.style.display = "block";

  // Build pantry text list
  const pantryList = pantryIngredients.map(p => p.name);

  try {
    const response = await fetch("/api/get-recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        containsIngredients: selectedIngredients,
        flavor: selectedFlavor,
        selectedPersonCount: selectedPersonCount,
        pantryIngredients: pantryList,
        currentRecipe: currentRecipe, // If focused, passes it to contextualize
        chatPrompt: chatPrompt
      })
    });

    const data = await response.json();
    if (data.success && data.recipes && data.recipes.length > 0) {
      // Set generated recipe as focused
      currentRecipe = data.recipes[0];
      updateRecipeViewer();
    } else {
      console.error("Failed to generate recipe.");
      alert("AI was unable to generate/update the recipe. Please try again.");
    }
  } catch (err) {
    console.error("API error:", err);
    alert("Connection error occurred. Please try again.");
  } finally {
    if (loader) loader.style.display = "none";
  }
}

// Firestore operations for Pantry Setup
async function loadPantryIngredients() {
  if (!userId) return;
  try {
    const q = query(collection(db, "pantry"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    pantryIngredients = [];
    snapshot.forEach(doc => {
      pantryIngredients.push({ id: doc.id, ...doc.data() });
    });
  } catch (err) {
    console.error("Error loading pantry:", err);
  }
}

async function addPantryIngredient(name) {
  if (!userId) return;
  try {
    const docRef = await addDoc(collection(db, "pantry"), {
      userId: userId,
      name: name,
      createdAt: new Date()
    });
    pantryIngredients.push({ id: docRef.id, userId, name });
    populateSidebarList();
  } catch (err) {
    console.error("Error adding pantry item:", err);
  }
}

async function deletePantryIngredient(id) {
  if (!userId) return;
  try {
    await deleteDoc(doc(db, "pantry", id));
    pantryIngredients = pantryIngredients.filter(p => p.id !== id);
    populateSidebarList();
  } catch (err) {
    console.error("Error deleting pantry item:", err);
  }
}

// Firestore operations for Saved Recipes
async function loadSavedRecipes() {
  if (!userId) return;
  try {
    const q = query(collection(db, "recipes"), where("userId", "==", userId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    savedRecipes = [];
    snapshot.forEach(doc => {
      savedRecipes.push({ id: doc.id, ...doc.data() });
    });
  } catch (err) {
    console.error("Error loading recipes:", err);
  }
}

async function saveRecipe(recipe) {
  if (!userId || !recipe) return;
  try {
    const docRef = await addDoc(collection(db, "recipes"), {
      userId: userId,
      dishName: recipe.dishName,
      flavor: recipe.flavor || "",
      goodFor: recipe.goodFor || "",
      ingredients: recipe.ingredients,
      procedures: recipe.procedures,
      difficulty: recipe.difficulty || "medium",
      createdAt: new Date()
    });
    
    // Refresh local list
    savedRecipes.unshift({ id: docRef.id, ...recipe });
    populateSidebarList();

    // Show saved popup
    document.getElementById("saved").style.display = "block";
  } catch (err) {
    console.error("Error saving recipe:", err);
  }
}

async function deleteRecipe(id) {
  if (!userId) return;
  try {
    await deleteDoc(doc(db, "recipes", id));
    savedRecipes = savedRecipes.filter(r => r.id !== id);
    if (currentRecipe && currentRecipe.id === id) {
      currentRecipe = null;
      updateRecipeViewer();
    }
    populateSidebarList();

    // Show deleted popup
    document.getElementById("deleted").style.display = "block";
  } catch (err) {
    console.error("Error deleting recipe:", err);
  }
}
