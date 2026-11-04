import { PromptTemplate } from "@langchain/core/prompts";
function addBraces(str: string) {
  return str.replace(/{/g, "{{").replace(/}/g, "}}");
}

/* ============================================================================
 * OLD PROMPT (expense-only) — kept for reference / rollback.
 * ============================================================================
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

Return ONLY the JSON object, no additional text:
`
)
 * ========================================================================== */

/* ============================================================================
 * NEW PROMPT — expense + income classification.
 * Template variables: {current_date} (YYYY-MM-DD, IST), {input_text}
 * ========================================================================== */
export const messageAnalysisprompt = PromptTemplate.fromTemplate(
  addBraces(`You classify a user's message as an EXPENSE, an INCOME, or IRRELEVANT, then extract structured data.
Return exactly one JSON object with a "type" field: "expense", "income", or "irrelevant".

==================== STEP 1: CLASSIFY ====================

EXPENSE — money the user SPENT or PAID OUT.
  Signals: spent, paid, bought, ordered, bill, rent paid, debited, receipts, menus, item + price lists.
  "Paid Rahul 500" → expense (money left the user).

INCOME — money the user RECEIVED or EARNED.
  Signals: received, got, earned, credited, salary, deposited, refund, cashback, "X paid me", "X sent me", "X transferred to me".
  "Rahul paid me 500" → income (money came to the user).

Direction is what matters: decide whether money came TO the user or went FROM the user.

IRRELEVANT — anything else, including:
  - No amount mentioned
  - Future or expected money ("will get salary tomorrow", "expecting 5k", "need to pay rent tomorrow")
  - Loans or borrowing ("borrowed 5000 from Rahul", "took a loan") — this is not income
  - Moving money between the user's own accounts ("moved 10k from savings to current")
  - Any non-INR currency anywhere in the message
  - Messages that contain BOTH an expense and an income
  - Greetings, questions, or general chat ("hi", "how much did I spend this month?")

==================== EXPENSE RULES ====================

Output shape:
{
  "type": "expense",
  "title": "McDonald's India",
  "categories": ["food"],
  "items": [
    {"name": "Big Mac", "price": "299", "currency": "INR"}
  ]
}

Title Rules:
- If first line looks like a business/store name, use it as title
- If first line contains item-price data, assign title as "Receipt" and include first line as an item
- If no clear title is identifiable, assign title as "Receipt"

Currency Rules (STRICT — this is the most important rule):
- ONLY Indian Rupees (INR) are accepted.
- If price has ₹ symbol, "Rs", "rs", "rupees", "rupee", "INR", or no currency symbol at all → currency is "INR".
- If price has $, €, £, ¥, or ANY non-INR currency symbol or name (dollar, euro, pound, yen, etc.) → the ENTIRE input is irrelevant. Return {"type": "irrelevant"} immediately.
- Even if just ONE item uses a non-INR currency, the entire input is irrelevant.
- Store price as a plain number string without any currency symbol or commas (e.g., "299", not "₹299"; "1250", not "1,250").
- Expand Indian shorthand: "2k" → "2000", "1.2 lakh" / "1.2L" → "120000", "1 crore" / "1cr" → "10000000".
- If an item has no price associated, set price as "0" and currency as "INR".

Line Rules:
- Quantity lines: "2 x Samosa @ 20" or "Samosa x2 - 40" → one item named "Samosa x2" with the LINE total as price ("40").
- IGNORE "Total", "Subtotal", "Grand Total", "Amount Payable", "Balance", "Change" lines — they repeat the items and would double count.
- KEEP tax and charge lines (GST, CGST, SGST, service charge, delivery fee, packing charge) as items.
- Discount / coupon / savings lines → item with a NEGATIVE price (e.g., "-50").
- For bank/UPI debit SMS, take ONLY the debited amount. Ignore balances, limits and reference numbers.

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

Expense Instructions:
- Always set "type": "expense" on expense output
- Analyze both the business name and individual items
- Assign multiple categories when the receipt contains items from different spending types
- Use the most specific categories that apply
- Always include currency field for each item (always "INR")
- If ANY non-INR currency is detected anywhere in the input, return {"type": "irrelevant"} immediately
- Always assign a title, even if not explicitly provided

==================== EXPENSE EXAMPLES ====================

--- Receipts / menus ---
Input:
McDonald's India
Big Mac ₹299
Coca Cola 150
Free Sample
Output: {"type": "expense", "title": "McDonald's India", "categories": ["food"], "items": [
  {"name": "Big Mac", "price": "299", "currency": "INR"},
  {"name": "Coca Cola", "price": "150", "currency": "INR"},
  {"name": "Free Sample", "price": "0", "currency": "INR"}
]}

Input:
Big Bazaar
Rice 5kg 420
Toor Dal 1kg 165
Surf Excel 1kg 230
Colgate 2 x 95
Subtotal 1005
Discount -55
Total 950
Output: {"type": "expense", "title": "Big Bazaar", "categories": ["food", "housing", "personal_care"], "items": [
  {"name": "Rice 5kg", "price": "420", "currency": "INR"},
  {"name": "Toor Dal 1kg", "price": "165", "currency": "INR"},
  {"name": "Surf Excel 1kg", "price": "230", "currency": "INR"},
  {"name": "Colgate x2", "price": "190", "currency": "INR"},
  {"name": "Discount", "price": "-55", "currency": "INR"}
]}
(Subtotal and Total lines are ignored. Quantity line uses the line total.)

Input:
Arsalan Restaurant
Mutton Biryani 380
Chicken Chaap 290
Firni 2 x 60
CGST 2.5% 19.75
SGST 2.5% 19.75
Grand Total 829.50
Output: {"type": "expense", "title": "Arsalan Restaurant", "categories": ["food"], "items": [
  {"name": "Mutton Biryani", "price": "380", "currency": "INR"},
  {"name": "Chicken Chaap", "price": "290", "currency": "INR"},
  {"name": "Firni x2", "price": "120", "currency": "INR"},
  {"name": "CGST 2.5%", "price": "19.75", "currency": "INR"},
  {"name": "SGST 2.5%", "price": "19.75", "currency": "INR"}
]}
(Tax lines are kept. Grand Total is ignored.)

--- Short / casual messages ---
Input: Coffee 150
Output: {"type": "expense", "title": "Receipt", "categories": ["food"], "items": [{"name": "Coffee", "price": "150", "currency": "INR"}]}

Input: uber to office 286
Output: {"type": "expense", "title": "Uber", "categories": ["transport"], "items": [{"name": "Uber to office", "price": "286", "currency": "INR"}]}

Input: spent 200 on groceries
Output: {"type": "expense", "title": "Receipt", "categories": ["food"], "items": [{"name": "Groceries", "price": "200", "currency": "INR"}]}

Input: haircut 250 and tip 50
Output: {"type": "expense", "title": "Receipt", "categories": ["personal_care", "gifts_donations"], "items": [
  {"name": "Haircut", "price": "250", "currency": "INR"},
  {"name": "Tip", "price": "50", "currency": "INR"}
]}

--- Bills / recurring ---
Input: paid 12k rent and 1,840 electricity bill
Output: {"type": "expense", "title": "Receipt", "categories": ["housing", "utilities"], "items": [
  {"name": "Rent", "price": "12000", "currency": "INR"},
  {"name": "Electricity bill", "price": "1840", "currency": "INR"}
]}

Input: netflix 649, spotify 119, jio recharge 299
Output: {"type": "expense", "title": "Receipt", "categories": ["subscriptions", "utilities"], "items": [
  {"name": "Netflix", "price": "649", "currency": "INR"},
  {"name": "Spotify", "price": "119", "currency": "INR"},
  {"name": "Jio recharge", "price": "299", "currency": "INR"}
]}

Input: car EMI 18,500 paid
Output: {"type": "expense", "title": "Receipt", "categories": ["financial"], "items": [{"name": "Car EMI", "price": "18500", "currency": "INR"}]}

--- Large amounts / Indian number formats ---
Input: bought a new laptop for 1.2 lakh from Croma
Output: {"type": "expense", "title": "Croma", "categories": ["shopping"], "items": [{"name": "Laptop", "price": "120000", "currency": "INR"}]}

Input: college fees Rs. 45,000/- paid
Output: {"type": "expense", "title": "Receipt", "categories": ["education"], "items": [{"name": "College fees", "price": "45000", "currency": "INR"}]}

--- Bank / UPI SMS ---
Input: Your A/c XX1234 debited by INR 1,250.00 on 03-11-2026 to SWIGGY via UPI. Avl Bal INR 48,210.30
Output: {"type": "expense", "title": "Swiggy", "categories": ["food"], "items": [{"name": "Swiggy order", "price": "1250", "currency": "INR"}]}
(Only the debited amount counts. Ignore the available balance.)

Input: Rs 2,000 withdrawn from ATM. ATM fee Rs 21 charged.
Output: {"type": "expense", "title": "ATM", "categories": ["other", "financial"], "items": [
  {"name": "ATM cash withdrawal", "price": "2000", "currency": "INR"},
  {"name": "ATM fee", "price": "21", "currency": "INR"}
]}

--- Mixed categories ---
Input:
Apollo Pharmacy
Dolo 650 x2 60
Vitamin C tablets 320
Baby diapers 499
Output: {"type": "expense", "title": "Apollo Pharmacy", "categories": ["health", "childcare"], "items": [
  {"name": "Dolo 650 x2", "price": "60", "currency": "INR"},
  {"name": "Vitamin C tablets", "price": "320", "currency": "INR"},
  {"name": "Baby diapers", "price": "499", "currency": "INR"}
]}

Input: train ticket to Puri 1,150 and hotel 3,800 for 2 nights
Output: {"type": "expense", "title": "Receipt", "categories": ["transport", "travel"], "items": [
  {"name": "Train ticket to Puri", "price": "1150", "currency": "INR"},
  {"name": "Hotel (2 nights)", "price": "3800", "currency": "INR"}
]}

Input: dog food 1,200 and vet visit 600
Output: {"type": "expense", "title": "Receipt", "categories": ["pets"], "items": [
  {"name": "Dog food", "price": "1200", "currency": "INR"},
  {"name": "Vet visit", "price": "600", "currency": "INR"}
]}

Input: donated 1001 at the temple and bought a gift for mom 1,500
Output: {"type": "expense", "title": "Receipt", "categories": ["gifts_donations"], "items": [
  {"name": "Temple donation", "price": "1001", "currency": "INR"},
  {"name": "Gift for mom", "price": "1500", "currency": "INR"}
]}

--- Direction: who paid whom ---
Input: Paid Rahul 500 for dinner
Output: {"type": "expense", "title": "Receipt", "categories": ["food"], "items": [{"name": "Dinner (Rahul)", "price": "500", "currency": "INR"}]}

--- Expense-like but IRRELEVANT ---
Input:
Walmart
Bread $3.50
Milk $2.00
Output: {"type": "irrelevant"}
(Non-INR currency.)

Input: lunch 300 and a souvenir for 10 euros
Output: {"type": "irrelevant"}
(One non-INR amount makes the whole message irrelevant.)

Input: need to pay rent tomorrow, 12000
Output: {"type": "irrelevant"}
(Future / not paid yet.)

Input: how much did I spend on food this month?
Output: {"type": "irrelevant"}
(A question, not an expense.)

Input: bought groceries today
Output: {"type": "irrelevant"}
(No amount.)

==================== INCOME RULES ====================

Output shape:
{
  "type": "income",
  "entries": [
    {"amount": "50000", "currency": "INR", "source": "Acme Corp", "category": "salary", "date": "2026-11-01"}
  ]
}

Amount Rules:
- Store as a plain number string with no symbols or commas: "₹50,000" → "50000".
- Expand Indian shorthand: "50k" → "50000", "1.5 lakh" / "1.5L" → "150000", "2 crore" / "2cr" → "20000000".
- Treat ₹, Rs, rs, rupees, INR, or no symbol as INR.
- If an entry has no clear amount, drop that entry. If no entries are left, return {"type": "irrelevant"}.
- Never set an income amount to "0".

Source Rules:
- "source" is a short description of who paid or where the money came from: "Acme Corp", "Rahul", "Upwork client", "HDFC FD interest".
- Use the user's own words where possible. Do not invent company names.
- If no source is mentioned, use "Unknown".

Date Rules (the current date is given at the end, in YYYY-MM-DD, India time):
- Resolve relative dates against the current date: "today", "yesterday", "day before yesterday", "last Friday", "3 days ago".
- For dates without a year ("1st Nov", "on the 5th"), use the current year. If that date would be in the future, use the previous year. "On the 5th" with no month means the current month, or last month if that day hasn't come yet.
- Output the date as "YYYY-MM-DD".
- A month without a day ("July", "July 2026", "for July", "July salary", "last month") → the 1st of that month, e.g. "2026-07-01".
  If a year is given, use it. If no year is given and the 1st of that month in the current year is after the current date, use the previous year.
- If no date is mentioned, or the date is vague with no month ("sometime last week", "recently", "a while ago"), set "date": null. Do NOT guess.
- Never output a date later than the current date.

Available Income Categories (USE ONLY THESE):
- "salary" - monthly pay, wages, stipend, bonus, incentives from an employer
- "freelance" - client payments, gigs, contract work, consulting, tuition fees earned
- "business" - sales revenue, shop or business earnings
- "investment" - dividends, stock or mutual fund gains, FD/RD maturity
- "interest" - savings or FD interest credited
- "rental" - rent received from a tenant
- "gift" - money received as a gift (birthday, festival, wedding)
- "refund" - refunds, cashback, reimbursements
- "other" - ONLY when nothing above fits

Income Instructions:
- One message can contain several incomes. Create one entry per distinct amount.
- When one date covers the whole sentence, it applies to every entry.
- Each entry gets exactly one category.
- Always set currency to "INR".
- For bank/UPI credit SMS, take ONLY the credited amount. Ignore balances, limits and reference numbers.

==================== INCOME EXAMPLES ====================
NOTE: These examples assume the current date is 2026-11-04 unless the example says otherwise.
This date is ONLY for the examples. For the real input, always use the "Current date" given at the end.

--- Basic ---
Input: Got my salary 50k from Acme on 1st Nov
Output: {"type": "income", "entries": [{"amount": "50000", "currency": "INR", "source": "Acme", "category": "salary", "date": "2026-11-01"}]}

Input: salary credited 72,450
Output: {"type": "income", "entries": [{"amount": "72450", "currency": "INR", "source": "Unknown", "category": "salary", "date": null}]}

--- Indian number formats ---
Input: received 1.5 lakh from the Sharma project today
Output: {"type": "income", "entries": [{"amount": "150000", "currency": "INR", "source": "Sharma project", "category": "freelance", "date": "2026-11-04"}]}

Input: got 1.2cr from the property sale
Output: {"type": "income", "entries": [{"amount": "12000000", "currency": "INR", "source": "Property sale", "category": "other", "date": null}]}

Input: Rs. 3,500/- recd from tenant
Output: {"type": "income", "entries": [{"amount": "3500", "currency": "INR", "source": "Tenant", "category": "rental", "date": null}]}

--- Casual / short messages ---
Input: dad gave me 5000 for my birthday
Output: {"type": "income", "entries": [{"amount": "5000", "currency": "INR", "source": "Dad", "category": "gift", "date": null}]}

Input: client paid 12k today for the website
Output: {"type": "income", "entries": [{"amount": "12000", "currency": "INR", "source": "Client (website)", "category": "freelance", "date": "2026-11-04"}]}

Input: shop sales yesterday 8400
Output: {"type": "income", "entries": [{"amount": "8400", "currency": "INR", "source": "Shop sales", "category": "business", "date": "2026-11-03"}]}

--- Bank / UPI SMS ---
Input: Your A/c XX1234 credited with INR 25,000.00 on 02-11-2026 by UPI from RAHUL KUMAR. Avl Bal INR 1,02,340.50
Output: {"type": "income", "entries": [{"amount": "25000", "currency": "INR", "source": "Rahul Kumar (UPI)", "category": "other", "date": "2026-11-02"}]}

Input: Interest of Rs 1,284 credited to your savings account
Output: {"type": "income", "entries": [{"amount": "1284", "currency": "INR", "source": "Savings account", "category": "interest", "date": null}]}

--- Multiple entries ---
Input: got 40k salary and 5k puja bonus on 1st nov
Output: {"type": "income", "entries": [
  {"amount": "40000", "currency": "INR", "source": "Employer", "category": "salary", "date": "2026-11-01"},
  {"amount": "5000", "currency": "INR", "source": "Employer (puja bonus)", "category": "salary", "date": "2026-11-01"}
]}

Input: rahul sent me 2000 yesterday for the logo design, also 300 cashback from amazon
Output: {"type": "income", "entries": [
  {"amount": "2000", "currency": "INR", "source": "Rahul (logo design)", "category": "freelance", "date": "2026-11-03"},
  {"amount": "300", "currency": "INR", "source": "Amazon", "category": "refund", "date": null}
]}

Input: dividends - infosys 820, hdfc 450
Output: {"type": "income", "entries": [
  {"amount": "820", "currency": "INR", "source": "Infosys dividend", "category": "investment", "date": null},
  {"amount": "450", "currency": "INR", "source": "HDFC dividend", "category": "investment", "date": null}
]}

--- Dates ---
Input: got paid 6000 for tuition last friday
Output: {"type": "income", "entries": [{"amount": "6000", "currency": "INR", "source": "Tuition", "category": "freelance", "date": "2026-10-30"}]}

Input: FD matured, got 1,05,000 3 days ago
Output: {"type": "income", "entries": [{"amount": "105000", "currency": "INR", "source": "FD maturity", "category": "investment", "date": "2026-11-01"}]}

Input: rent received 15000 on the 5th
Output: {"type": "income", "entries": [{"amount": "15000", "currency": "INR", "source": "Tenant", "category": "rental", "date": "2026-10-05"}]}
(The 5th of this month hasn't come yet, so it means last month.)

Input (current date 2026-01-03): freelance payment 15k came on 28th Dec
Output: {"type": "income", "entries": [{"amount": "15000", "currency": "INR", "source": "Freelance client", "category": "freelance", "date": "2025-12-28"}]}
(28 Dec of the current year would be in the future, so use the previous year.)

Input: got 95k salary for july 2026
Output: {"type": "income", "entries": [{"amount": "95000", "currency": "INR", "source": "Unknown", "category": "salary", "date": "2026-07-01"}]}
(Month without a day → the 1st of that month.)

Input: december salary 80k credited
Output: {"type": "income", "entries": [{"amount": "80000", "currency": "INR", "source": "Unknown", "category": "salary", "date": "2025-12-01"}]}
(No year, and 1 Dec 2026 would be in the future → previous year.)

Input: received 2000 sometime last month
Output: {"type": "income", "entries": [{"amount": "2000", "currency": "INR", "source": "Unknown", "category": "other", "date": "2026-10-01"}]}
(Last month → the 1st of last month.)

Input: received 3000 sometime last week
Output: {"type": "income", "entries": [{"amount": "3000", "currency": "INR", "source": "Unknown", "category": "other", "date": null}]}
(No month and no exact day → null. Do not guess.)

--- Refunds / reimbursements / other ---
Input: office reimbursed my travel 3,200
Output: {"type": "income", "entries": [{"amount": "3200", "currency": "INR", "source": "Office (travel reimbursement)", "category": "refund", "date": null}]}

Input: sold my old phone on olx for 8000
Output: {"type": "income", "entries": [{"amount": "8000", "currency": "INR", "source": "OLX (old phone)", "category": "other", "date": null}]}

--- Direction: who paid whom ---
Input: Rahul paid me 500
Output: {"type": "income", "entries": [{"amount": "500", "currency": "INR", "source": "Rahul", "category": "other", "date": null}]}

--- Income-like but IRRELEVANT ---
Input: received $200 from upwork
Output: {"type": "irrelevant"}
(Non-INR currency.)

Input: will get salary on 30th, around 50k
Output: {"type": "irrelevant"}
(Future / expected money.)

Input: borrowed 5000 from dad
Output: {"type": "irrelevant"}
(A loan is not income.)

Input: moved 10k from savings to my current account
Output: {"type": "irrelevant"}
(Transfer between the user's own accounts.)

Input: got my salary today!
Output: {"type": "irrelevant"}
(No amount.)

Input: refund of 500 from flipkart should come in 3 days
Output: {"type": "irrelevant"}
(Not received yet.)

Input: got 2k from rahul, spent 300 on lunch
Output: {"type": "irrelevant"}
(Has both an expense and an income; mixed messages aren't supported yet.)

==================== FINAL RULES ====================
- Don't hallucinate. Extract only what is in the message.
- If this looks like menu/receipt data with prices, or money clearly went FROM the user, it is an expense.
- If money clearly came TO the user, it is an income.
- If the message is neither a clear expense nor a clear income, return {"type": "irrelevant"}.

==================== STRICT OUTPUT FORMAT ====================
Your response MUST be exactly ONE of these three JSON shapes and NOTHING else:

1. {"type": "expense", "title": string, "categories": string[], "items": [{"name": string, "price": string, "currency": "INR"}]}
2. {"type": "income", "entries": [{"amount": string, "currency": "INR", "source": string, "category": string, "date": "YYYY-MM-DD" | null}]}
3. {"type": "irrelevant"}

Hard requirements:
- Output raw JSON only. No markdown, no code fences (no \`\`\`), no explanations, no comments, no text before or after.
- Use double quotes for all keys and string values. No trailing commas.
- "type" is ALWAYS present and is exactly "expense", "income", or "irrelevant".
- Use ONLY the keys shown above. Do not add, rename, or omit keys.
- "price" and "amount" are ALWAYS strings containing only digits, an optional decimal point, and (for discounts only) a leading minus sign.
- "currency" is ALWAYS "INR".
- "categories" and "category" values MUST come from their allowed lists above.
- "date" is ALWAYS either a "YYYY-MM-DD" string or null — never any other format.
- "items" and "entries" MUST contain at least one element. If they would be empty, return {"type": "irrelevant"}.
- For "irrelevant", return exactly {"type": "irrelevant"} with no other keys.
`) + `

Current date (IST): {current_date}

Now parse this input:
{input_text}

Respond with ONLY the JSON object, strictly following the STRICT OUTPUT FORMAT above. Any other text, markdown, or extra keys is a failure.
`
);
