const calculateSettlement = (participants) => {
  // Validate at least 2 users
  if (!participants || participants.length < 2) {
    throw new Error("At least 2 participants are required");
  }

  let total = 0;
  for (let i = 0; i < participants.length; i++) {
    // Treat empty amounts or missing amounts as 0, but user requested "Ignore empty inputs". Assuming that means if amount is empty string, we ignore or treat as 0. The payload should have valid numbers.
    let amount = participants[i].amountPaid;
    if (amount === "" || amount == null) amount = 0;
    amount = Number(amount);

    if (isNaN(amount) || amount < 0) {
      throw new Error("Invalid or negative amount provided");
    }
    total += amount;
  }

  // share = total / n, round to 2 decimals
  const share = total / participants.length;
  const roundedShare = Math.round(share * 100) / 100;

  const balances = [];
  participants.forEach((p) => {
    let amount = p.amountPaid;
    if (amount === "" || amount == null) amount = 0;
    amount = Number(amount);

    // balance = paid - share
    let balance = amount - roundedShare;
    balance = Math.round(balance * 100) / 100;
    
    balances.push({
      userId: p.userId,
      name: p.name,
      balance: balance,
    });
  });

  // Separate and sort
  // creditors = balance > 0 (sorted DESC)
  const creditors = balances
    .filter((b) => b.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  // debtors = balance < 0 (sorted ASC)
  const debtors = balances
    .filter((b) => b.balance < 0)
    .sort((a, b) => a.balance - b.balance);

  const settlements = [];

  let i = 0; // debtors index
  let j = 0; // creditors index

  // Settlement Logic:
  // FOR each debtor:
  // FOR each creditor:
  // amount = min(abs(debtor.balance), creditor.balance)
  
  while (i < debtors.length && j < creditors.length) {
    let debtor = debtors[i];
    let creditor = creditors[j];

    let debtAmount = Math.abs(debtor.balance);
    let creditAmount = creditor.balance;

    let settlingAmount = Math.min(debtAmount, creditAmount);
    settlingAmount = Math.round(settlingAmount * 100) / 100;

    if (settlingAmount > 0) {
      settlements.push({
        from: debtor.userId,
        fromName: debtor.name,
        to: creditor.userId,
        toName: creditor.name,
        amount: settlingAmount,
      });
    }

    // update balances
    debtor.balance = Math.round((debtor.balance + settlingAmount) * 100) / 100;
    creditor.balance = Math.round((creditor.balance - settlingAmount) * 100) / 100;

    if (Math.abs(debtor.balance) < 0.01) i++;
    if (Math.abs(creditor.balance) < 0.01) j++;
  }

  return settlements;
};

module.exports = { calculateSettlement };
