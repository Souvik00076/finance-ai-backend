/*
 * title 
 * data price 
 * data price 
 * data price
 * data price
 */
import { JsonOutputParser, StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import express from 'express'
import { OpenAI } from 'openai/client.js'
const app = express()
const gemini = new ChatOpenAI({
  model: "gemini-2.0-flash",
  configuration: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: 'AIzaSyC9ye9FRdvK_xtDpuMRP2_pH1JS6yq7b9o',
  },
  streaming: false
})
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
function addBraces(str: string) {
  return str.replace(/{/g, "{{").replace(/}/g, "}}");
}
app.post('/hook', async (req, res) => {
  const data = req.body.Body;

  const prompt = PromptTemplate.fromTemplate(
    addBraces(`Parse the following text which includes  title and contain item names and prices. Also categorize the type of spending.

Example Input:
McDonald's India
Big Mac ₹299
French Fries $2.49
Coca Cola 150
Free Sample

Example Output:
{
  "title": "McDonald's India",
  "categories": ["food"],
  "items": [
    {"name": "Big Mac", "price": "₹299", "currency": "INR"},
    {"name": "French Fries", "price": "$2.49", "currency": "USD"},
    {"name": "Coca Cola", "price": "₹150", "currency": "INR"},
    {"name": "Free Sample", "price": "₹0", "currency": "INR"}
  ]
}

Title Rules:
- If first line looks like a business/store name, use it as title
- If first line contains item-price data, assign title as "Receipt" and include first line as an item
- If no clear title is identifiable, assign title as "Receipt"

Currency Rules:
- If price has ₹ symbol, currency is "INR"
- If price has $ symbol, currency is "USD" 
- If price has € symbol, currency is "EUR"
- If price has £ symbol, currency is "GBP"
- If no currency symbol found, default currency is "INR" and add ₹ symbol to price
- If an item has no price associated, mark price as "₹0" and currency as "INR"
- during putting in price dont forget to remove the price symbol from value.

Available Categories:
- "food" - restaurants, groceries, food delivery, beverages
- "transport" - gas, uber, taxi, public transport, parking
- "shopping" - clothing, electronics, general retail, home goods
- "entertainment" - movies, games, events, streaming, books
- "health" - pharmacy, medical, fitness, supplements
- "utilities" - electricity, water, internet, phone bills
- "other" - miscellaneous expenses

Instructions:
- Analyze both the business name and individual items
- Assign multiple categories when the receipt contains items from different spending types
- Use the most specific categories that apply
- If uncertain, include "other" as a fallback category
- Always include currency field for each item
- Convert plain numbers to rupees format (e.g., 150 becomes "₹150")
- If an item line has no recognizable price, set price as "₹0" and currency as "INR"
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
  console.log(data);
  const chain = prompt.pipe(gemini).pipe(new JsonOutputParser<any>());
  const val = await chain.invoke({ input_text: data })
  console.log(val);
  res.json()
})

app.listen(3000, () => {
  console.log("Listening to port 3000")
})


