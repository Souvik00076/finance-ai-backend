import { PromptTemplate } from "@langchain/core/prompts";
function addBraces(str: string) {
  return str.replace(/{/g, "{{").replace(/}/g, "}}");
}
export const messageAnalysisprompt = PromptTemplate.fromTemplate(
  addBraces(`Parse the following text which includes  title and contain item names and prices. Also categorize the type of spending.

Example Input 1:
McDonald's India
Big Mac ₹299
Coca Cola 150
Free Sample

Example Output 1:
{
  "title": "McDonald's India",
  "categories": ["food"],
  "items": [
    {"name": "Big Mac", "price": "299", "currency": "INR"},
    {"name": "Coca Cola", "price": "150", "currency": "INR"},
    {"name": "Free Sample", "price": "0", "currency": "INR"}
  ]
}

Example Input 2:
Walmart
Bread $3.50
Milk $2.00

Example Output 2:
{
  "type": "irrelevant"
}

Title Rules:
- If first line looks like a business/store name, use it as title
- If first line contains item-price data, assign title as "Receipt" and include first line as an item
- If no clear title is identifiable, assign title as "Receipt"

Currency Rules (STRICT — this is the most important rule):
- ONLY Indian Rupees (INR) are accepted.
- If price has ₹ symbol, "Rs", "rs", "rupees", "rupee", or no currency symbol at all → currency is "INR".
- If price has $, €, £, ¥, or ANY non-INR currency symbol or name (dollar, euro, pound, yen, etc.) → the ENTIRE input is irrelevant. Return {"type": "irrelevant"} immediately.
- Even if just ONE item uses a non-INR currency, the entire input is irrelevant.
- Store price as a plain number string without any currency symbol (e.g., "299", not "₹299").
- If an item has no price associated, set price as "0" and currency as "INR".

Available Categories (USE ONLY THESE — no custom categories allowed):
- "food" - restaurants, groceries, food delivery, beverages, cafes, bakeries, snacks, meal kits
- "transport" - gas, fuel, uber, taxi, public transport, parking, tolls, vehicle maintenance, flights, train tickets
- "shopping" - clothing, electronics, general retail, home goods, furniture, appliances, accessories, online shopping
- "entertainment" - movies, games, events, streaming subscriptions, books, music, concerts, sports, hobbies
- "health" - pharmacy, medical bills, doctor visits, fitness, gym, supplements, insurance premiums, dental, vision
- "utilities" - electricity, water, internet, phone bills, gas bills, cable, waste disposal
- "education" - tuition, courses, books, stationery, school supplies, certifications, training
- "personal_care" - salon, spa, cosmetics, grooming, skincare, hygiene products
- "housing" - rent, mortgage, repairs, maintenance, cleaning supplies, pest control
- "subscriptions" - recurring digital services, SaaS, memberships, magazines, newsletters
- "travel" - hotels, lodging, vacation packages, travel insurance, sightseeing, luggage
- "gifts_donations" - gifts, charity, donations, tithes, tips
- "financial" - bank fees, loan payments, interest charges, investment fees, ATM fees
- "pets" - pet food, vet bills, grooming, pet supplies, pet insurance
- "childcare" - daycare, babysitting, child supplies, toys, diapers
- "other" - ONLY when no above category fits at all

Strict Categorization Rules:
- You MUST pick from the above list. Do NOT invent new category names.
- Assign exactly the categories that match. Prefer specific categories over "other".
- Only use "other" as a last resort when the item genuinely does not fit any listed category.
- A single receipt may have multiple categories if items span different types.

Instructions:
- Analyze both the business name and individual items
- Assign multiple categories when the receipt contains items from different spending types
- Use the most specific categories that apply
- Always include currency field for each item (always "INR")
- Store prices as plain numbers without symbols (e.g., 150 becomes "150")
- If an item line has no recognizable price, set price as "0" and currency as "INR"
- If ANY non-INR currency is detected anywhere in the input, return {"type": "irrelevant"} immediately
- Always assign a title, even if not explicitly provided

If the input data is not related to menus, receipts, or pricing information, return:
{
  "type": "irrelevant"
}

Don't hallucinate. If this looks like menu/receipt data with prices, parse it. If not, mark as irrelevant.
`) + `

Now parse this input:
{input_text}
Dont hallucinate
Return ONLY the JSON object, no additional text:
`
)

