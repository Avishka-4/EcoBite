package com.ecobite.app.api;

import com.ecobite.app.api.models.Recipe;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class MockDataService {

    public static List<Recipe> getMockRecipes(List<String> userIngredients) {
        List<String> names = extractCoreNames(userIngredients);
        String label    = names.isEmpty() ? "Mixed" : capitalize(names.get(0));
        String nameList = joinFirst(names, 3);

        List<Recipe> list = new ArrayList<>();
        list.add(makeStirFry(userIngredients, label, nameList));
        list.add(makeSoup(userIngredients, label, nameList));
        list.add(makeScramble(userIngredients, label, nameList));
        list.add(makeRoasted(userIngredients, label, nameList));
        list.add(makePasta(userIngredients, label, nameList));
        return list;
    }

    /* ── Recipe builders ── */

    private static Recipe makeStirFry(List<String> userIngredients, String label, String nameList) {
        Recipe r = new Recipe();
        r.id = "mock_r1";
        r.name = label + " Stir Fry";
        r.description = "A quick and flavorful stir fry with " + nameList
                + " tossed in a savory garlic-soy glaze.";
        r.cookTime = "15 minutes";
        r.servings = 2;
        r.difficulty = "Easy";
        r.ingredients = combine(userIngredients,
                "2 cloves garlic, minced",
                "2 tbsp soy sauce",
                "1 tbsp vegetable oil",
                "1 tsp sesame oil",
                "1 tbsp oyster sauce",
                "Salt and pepper");
        r.missingIngredients = Arrays.asList("Oyster sauce");
        r.instructions = Arrays.asList(
                "Prep all ingredients: wash, peel and cut into bite-sized pieces.",
                "Heat vegetable oil in a wok or large pan over high heat.",
                "Add garlic and stir for 30 seconds until fragrant.",
                "Add your ingredients, starting with the densest ones first.",
                "Stir fry on high heat for 4–5 minutes, tossing constantly.",
                "Pour in soy sauce and oyster sauce; toss to coat evenly.",
                "Drizzle sesame oil, season with salt and pepper, and serve immediately."
        );
        r.imageUrl = null;
        return r;
    }

    private static Recipe makeSoup(List<String> userIngredients, String label, String nameList) {
        Recipe r = new Recipe();
        r.id = "mock_r2";
        r.name = "Comforting " + label + " Soup";
        r.description = "A warming, hearty soup built around " + nameList
                + " simmered in a flavourful broth.";
        r.cookTime = "30 minutes";
        r.servings = 3;
        r.difficulty = "Easy";
        r.ingredients = combine(userIngredients,
                "1 litre vegetable or chicken broth",
                "1 medium onion, diced",
                "2 cloves garlic, minced",
                "1 tbsp olive oil",
                "Salt, pepper and fresh herbs to taste");
        r.missingIngredients = new ArrayList<>();
        r.instructions = Arrays.asList(
                "Heat olive oil in a large pot over medium heat.",
                "Add onion and garlic; sauté for 3–4 minutes until softened.",
                "Add your ingredients to the pot and stir to combine.",
                "Pour in broth and bring to a boil.",
                "Reduce heat and simmer for 20 minutes until everything is tender.",
                "Season generously with salt, pepper and fresh herbs.",
                "Serve hot with crusty bread on the side."
        );
        r.imageUrl = null;
        return r;
    }

    private static Recipe makeScramble(List<String> userIngredients, String label, String nameList) {
        Recipe r = new Recipe();
        r.id = "mock_r3";
        r.name = label + " Egg Scramble";
        r.description = "Fluffy scrambled eggs loaded with " + nameList
                + " for a quick and satisfying meal any time of day.";
        r.cookTime = "10 minutes";
        r.servings = 1;
        r.difficulty = "Easy";
        r.ingredients = combine(userIngredients,
                "3 large eggs",
                "2 tbsp butter",
                "2 tbsp milk or cream",
                "Salt and pepper",
                "Fresh chives or parsley to garnish");
        r.missingIngredients = Arrays.asList("Fresh chives");
        r.instructions = Arrays.asList(
                "Crack eggs into a bowl, add milk, salt and pepper, and whisk well.",
                "Melt butter in a non-stick pan over medium-low heat.",
                "Add your ingredients and sauté for 2 minutes.",
                "Pour in the egg mixture and let it sit for 20 seconds.",
                "Gently fold the eggs with a spatula, moving them slowly.",
                "Remove from heat while still slightly underdone — they finish off the heat.",
                "Garnish with fresh chives and serve immediately."
        );
        r.imageUrl = null;
        return r;
    }

    private static Recipe makeRoasted(List<String> userIngredients, String label, String nameList) {
        Recipe r = new Recipe();
        r.id = "mock_r4";
        r.name = "Roasted " + label + " Medley";
        r.description = capitalize(nameList) + " roasted to perfection with olive oil and herbs"
                + " — simple, golden and delicious.";
        r.cookTime = "35 minutes";
        r.servings = 3;
        r.difficulty = "Easy";
        r.ingredients = combine(userIngredients,
                "3 tbsp extra virgin olive oil",
                "1 tsp dried rosemary",
                "1 tsp dried thyme",
                "4 cloves garlic, unpeeled",
                "Salt and black pepper",
                "Juice of half a lemon");
        r.missingIngredients = new ArrayList<>();
        r.instructions = Arrays.asList(
                "Preheat oven to 200°C (400°F) and line a baking tray with parchment.",
                "Cut your ingredients into even-sized pieces for uniform cooking.",
                "Toss everything with olive oil, rosemary, thyme, salt and pepper.",
                "Spread in a single layer on the tray; nestle garlic cloves among them.",
                "Roast for 25–30 minutes, turning once halfway through.",
                "Squeeze lemon juice over everything as soon as it comes out of the oven.",
                "Serve as a side dish or over a bed of grains or leafy greens."
        );
        r.imageUrl = null;
        return r;
    }

    private static Recipe makePasta(List<String> userIngredients, String label, String nameList) {
        Recipe r = new Recipe();
        r.id = "mock_r5";
        r.name = "Creamy " + label + " Pasta";
        r.description = "A rich and creamy pasta dish featuring " + nameList
                + " in a silky garlic cream sauce.";
        r.cookTime = "25 minutes";
        r.servings = 2;
        r.difficulty = "Medium";
        r.ingredients = combine(userIngredients,
                "200g penne or fettuccine",
                "150ml heavy cream",
                "2 cloves garlic, minced",
                "1 tbsp butter",
                "30g parmesan, grated",
                "Salt, pepper and fresh basil");
        r.missingIngredients = Arrays.asList("Heavy cream", "Parmesan");
        r.instructions = Arrays.asList(
                "Cook pasta in well-salted boiling water until al dente; reserve ½ cup pasta water.",
                "Melt butter in a wide pan over medium heat; add garlic and cook 1 minute.",
                "Add your ingredients and sauté for 3–4 minutes.",
                "Pour in cream and let it bubble gently for 2 minutes.",
                "Drain pasta and add directly to the pan; toss to coat.",
                "Splash in pasta water as needed to loosen the sauce.",
                "Stir in parmesan, adjust seasoning, and serve with fresh basil."
        );
        r.imageUrl = null;
        return r;
    }

    /* ── Helpers ── */

    private static List<String> combine(List<String> userIngredients, String... extras) {
        List<String> result = new ArrayList<>(userIngredients);
        result.addAll(Arrays.asList(extras));
        return result;
    }

    private static List<String> extractCoreNames(List<String> formatted) {
        List<String> names = new ArrayList<>();
        for (String s : formatted) names.add(extractCoreName(s));
        return names;
    }

    // Strips quantity prefix ("2 cups", "500g", "3") and condition suffix ("(Fresh)").
    private static String extractCoreName(String s) {
        s = s.replaceAll("\\s*\\([^)]+\\)\\s*$", "").trim();
        s = s.replaceAll("^[\\d.,/]+(\\s*[a-zA-Z]{1,4})?\\s+", "").trim();
        s = s.replaceAll("(?i)^(half|a|an|some|few)\\s+", "").trim();
        return s;
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static String joinFirst(List<String> names, int max) {
        if (names.isEmpty()) return "your ingredients";
        int limit = Math.min(names.size(), max);
        if (limit == 1) return names.get(0).toLowerCase();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < limit; i++) {
            if (i > 0) sb.append(i == limit - 1 ? " and " : ", ");
            sb.append(names.get(i).toLowerCase());
        }
        return sb.toString();
    }
}
