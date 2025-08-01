/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");

/* Array to keep track of selected products */
let selectedProducts = [];

/* Track which product card is expanded for description */
let expandedProductId = null;

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card${
      selectedProducts.some((p) => p.id === product.id) ? " selected" : ""
    }${expandedProductId === product.id ? " expanded" : ""}" 
         data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button class="details-btn" data-details-id="${product.id}">
          ${expandedProductId === product.id ? "Hide Details" : "Show Details"}
        </button>
        ${
          expandedProductId === product.id
            ? `<div class="product-description">${product.description}</div>`
            : ""
        }
      </div>
    </div>
  `
    )
    .join("");

  // Add click event listeners to each product card for selection
  const cards = productsContainer.querySelectorAll(".product-card");
  cards.forEach((card) => {
    card.addEventListener("click", (event) => {
      // Prevent click if details button was clicked
      if (
        event.target.classList.contains("details-btn") ||
        event.target.closest(".details-btn")
      ) {
        return;
      }
      const productId = Number(card.getAttribute("data-product-id"));
      const product = products.find((p) => p.id === productId);
      const alreadySelected = selectedProducts.some((p) => p.id === productId);
      if (alreadySelected) {
        selectedProducts = selectedProducts.filter((p) => p.id !== productId);
      } else {
        selectedProducts.push(product);
      }
      displayProducts(products);
      renderSelectedProducts();
    });
  });

  // Add click event listeners to "Show Details"/"Hide Details" buttons
  const detailBtns = productsContainer.querySelectorAll(".details-btn");
  detailBtns.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation(); // Prevent card selection
      const productId = Number(btn.getAttribute("data-details-id"));
      // Toggle expanded state
      expandedProductId = expandedProductId === productId ? null : productId;
      displayProducts(products);
    });
  });
}

/* Render the selected products as chips with remove buttons */
function renderSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<span class="placeholder-message" style="padding:16px;font-size:15px;">No products selected yet.</span>`;
    return;
  }
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <span class="selected-product-chip" data-product-id="${product.id}">
        ${product.name}
        <button title="Remove" aria-label="Remove ${product.name}">&times;</button>
      </span>
    `
    )
    .join("");

  // Add event listeners to remove buttons
  const chips = selectedProductsList.querySelectorAll(
    ".selected-product-chip button"
  );
  chips.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering card click
      const chip = btn.parentElement;
      const productId = Number(chip.getAttribute("data-product-id"));
      selectedProducts = selectedProducts.filter((p) => p.id !== productId);
      // Re-render both sections
      // If a category is selected, reload filtered products
      const selectedCategory = categoryFilter.value;
      if (selectedCategory) {
        loadProducts().then((products) => {
          const filtered = products.filter(
            (p) => p.category === selectedCategory
          );
          displayProducts(filtered);
        });
      }
      renderSelectedProducts();
    });
  });
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Initial render of selected products */
renderSelectedProducts();

/* Store the conversation history for the chat */
let messages = [];

/* When the user clicks "Generate Routine", send selected products to OpenAI and show the routine */
generateRoutineBtn.addEventListener("click", async () => {
  // If no products are selected, show a message and stop
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML = `<div class="placeholder-message" style="padding:16px;">Please select at least one product to generate a routine.</div>`;
    return;
  }

  // Show a loading message
  chatWindow.innerHTML = `<div class="placeholder-message" style="padding:16px;">Generating your personalized routine...</div>`;

  // Prepare the product data to send (only include needed fields)
  const productData = selectedProducts.map((p) => ({
    name: p.name,
    brand: p.brand,
    category: p.category,
    description: p.description,
  }));

  // Start a new conversation history
  messages = [
    {
      role: "system",
      content:
        "You are a helpful skincare and beauty advisor. Create a step-by-step routine using only the provided products. Explain the order and purpose of each product in a friendly, clear way for beginners. Only use the products listed. If the user asks a follow-up, only answer questions about the routine, skincare, haircare, makeup, fragrance, or related topics.",
    },
    {
      role: "user",
      content: `Here are the selected products as JSON:\n${JSON.stringify(
        productData,
        null,
        2
      )}\nPlease generate a routine using only these products.`,
    },
  ];

  try {
    // Make a POST request to the Cloudflare Worker proxy for OpenAI's API
    const response = await fetch(
      "https://soft-cloud-658b.bdgalaxy04.workers.dev/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      }
    );

    const data = await response.json();

    // Check if the response contains the routine
    if (
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      // Add the AI's response to the conversation history
      messages.push({
        role: "assistant",
        content: data.choices[0].message.content,
      });
      // Show the routine in the chat window
      chatWindow.innerHTML = `<div style="white-space:pre-line;">${data.choices[0].message.content}</div>`;
    } else {
      chatWindow.innerHTML =
        "<div class='placeholder-message' style='padding:16px;'>Sorry, I couldn't generate a routine. Please try again.</div>";
    }
  } catch (error) {
    // Show an error message if something goes wrong
    chatWindow.innerHTML =
      "<div class='placeholder-message' style='padding:16px;'>There was an error connecting to the AI. Please check your API key and try again.</div>";
  }
});

/* Chat form submission handler - send follow-up questions to OpenAI */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Get the user's question from the input box
  const userInput = document.getElementById("userInput").value.trim();
  if (!userInput) return;

  // Add the user's question to the conversation history
  messages.push({
    role: "user",
    content: userInput,
  });

  // Show the user's question and a loading message in the chat window
  chatWindow.innerHTML =
    `<div style="margin-bottom:12px;"><strong>You:</strong> ${userInput}</div>` +
    `<div class="placeholder-message" style="padding:16px;">Thinking...</div>`;

  // Clear the input box
  document.getElementById("userInput").value = "";

  try {
    // Send the full conversation history to the API
    const response = await fetch(
      "https://soft-cloud-658b.bdgalaxy04.workers.dev/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      }
    );

    const data = await response.json();

    // Check if the response contains an answer
    if (
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      // Add the AI's reply to the conversation history
      messages.push({
        role: "assistant",
        content: data.choices[0].message.content,
      });
      // Show the conversation (last user + last assistant message)
      chatWindow.innerHTML =
        `<div style="margin-bottom:12px;"><strong>You:</strong> ${userInput}</div>` +
        `<div style="white-space:pre-line;"><strong>Advisor:</strong> ${data.choices[0].message.content}</div>`;
    } else {
      chatWindow.innerHTML =
        "<div class='placeholder-message' style='padding:16px;'>Sorry, I couldn't answer your question. Please try again.</div>";
    }
  } catch (error) {
    chatWindow.innerHTML =
      "<div class='placeholder-message' style='padding:16px;'>There was an error connecting to the AI. Please try again.</div>";
  }
});
