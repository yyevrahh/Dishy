import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/api/get-recipe", async (request, result) => {
  const { 
    containsIngredients, 
    flavor, 
    difficulty, 
    count,
    chatPrompt,
    currentRecipe,
    pantryIngredients,
    selectedPersonCount
  } = request.body;

  try {
    let prompt = "";

    if (currentRecipe) {
      // Modifying/Contextualizing an existing recipe
      prompt = `
        The user wants to modify or update the following existing recipe:
        ${JSON.stringify(currentRecipe)}

        Based on the user's instructions: "${chatPrompt || "update the recipe"}".

        Other selected filters that you should incorporate if applicable:
        - Ingredients to add/use: ${containsIngredients || "not specified"}
        - Desired flavor: ${flavor || "not specified"}
        - Servings / Number of people: ${selectedPersonCount || "not specified"}

        Generate the UPDATED recipe in strict JSON format. Return a JSON array containing a single updated recipe object:
        [
          {
            "dishName": "Updated Dish Name",
            "flavor": "Updated Flavor",
            "goodFor": "Good for X people",
            "difficulty": "${difficulty || currentRecipe.difficulty || "medium"}",
            "ingredients": ["Ingredient 1 with metric quantity", "Ingredient 2 with metric quantity"],
            "procedures": ["Instruction Step 1", "Instruction Step 2"]
          }
        ]

        Ensure that the response is a valid JSON array and nothing else. Don't include extra text or markdown formatting blocks (like \`\`\`json).
        All sentences should start with an uppercase letter.
        The dish name must accurately represent the main ingredients.
        Ensure all ingredients include accurate quantities and units (e.g., grams, ml, or pieces) based on metric measurements.
      `;
    } else {
      // New Recipe Suggestion/Generation
      let ingredientContext = containsIngredients || "";
      let flavorContext = flavor || "";
      let personCountContext = selectedPersonCount || "";

      // If no parameters are selected, use pantry setup ingredients
      let usingPantry = false;
      if (!ingredientContext && !flavorContext && !personCountContext && pantryIngredients && pantryIngredients.length > 0) {
        ingredientContext = pantryIngredients.join(", ");
        usingPantry = true;
      }

      prompt = `
        Generate a recipe based on the user's request: "${chatPrompt || "suggest a delicious recipe"}".

        Contextual details:
        - Specified ingredients to include: ${ingredientContext || "any"} ${usingPantry ? "(These are ingredients from the user's pantry. Try to use them!)" : ""}
        - Desired flavor profile: ${flavorContext || "any"}
        - Number of people to serve: ${personCountContext || "any"}

        Generate the recipe in strict JSON format. Return a JSON array containing a single recipe object:
        [
          {
            "dishName": "Dish Name",
            "flavor": "Flavor",
            "goodFor": "Good for ${personCountContext || "4"} people",
            "difficulty": "${difficulty || "medium"}",
            "ingredients": ["Ingredient 1 with metric quantity", "Ingredient 2 with metric quantity"],
            "procedures": ["Instruction Step 1", "Instruction Step 2"]
          }
        ]

        Ensure that the response is a valid JSON array and nothing else. Don't include extra text or markdown formatting blocks (like \`\`\`json).
        All sentences should start with an uppercase letter.
        The dish name must accurately represent the main ingredients.
        Ensure all ingredients include accurate quantities and units (e.g., grams, ml, or pieces) based on metric measurements.
      `;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const generationConfig = {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    };

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), 30000)
    );

    const geminiCall = model.generateContent(prompt);
    const response = await Promise.race([geminiCall, timeout]);
    
    let responseText = response.response.text();
    // Clean up any potential markdown json blocks if Gemini returns them
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const recipes = JSON.parse(responseText);

    result.status(200).json({ success: true, recipes });
  } catch (error) {
    console.error("Error generating recipe:", error);
    if (error.message === "Request timed out") {
      result.status(504).json({ success: false, message: "Request timed out" });
    } else {
      result.status(500).json({ success: false, message: "Failed to generate recipe" });
    }
  }
});

export default app;
