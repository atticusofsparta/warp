export async function handle(state, action) {
  const input = action.input;
  const caller = action.caller;

  if (input.function === 'mint') {
    await SmartWeave.kv.put('mint.' + input.target, input.qty);
    await SmartWeave.kv.put(input.target, input.qty);

    return {state};
  }

  if (input.function === 'writeCheck') {
    const target = input.target;
    const qty = input.qty;

    let callerBalance = await SmartWeave.kv.get(caller);
    callerBalance = callerBalance ? callerBalance : 0;

    if (callerBalance < qty) {
      throw new ContractError(`Caller balance ${callerBalance} not high enough to write check for ${qty}!`);
    }

    const allChecks = (await SmartWeave.kv.entries({ gte: 'check.' + caller, lte: 'check.' + caller + '.\xff'}))
      .reduce((acc, entry) => acc + parseInt(entry.value), 0)

    if (callerBalance < allChecks + qty) {
      throw new ContractError(`Caller balance ${callerBalance} not high enough to write next check ${qty}!`);
    }

    await SmartWeave.kv.put('check.' + caller + '.' + target, qty);

    return {state};
  }


  if (input.function === 'cashCheck') {
    const target = input.target;

    const check = await SmartWeave.kv.get('check.' + target + '.' + caller);

    let targetBalance = await SmartWeave.kv.get(target);
    if (targetBalance < check) {
      throw new ContractError(`Target balance ${targetBalance} not high enough to cash check for ${check}!`);
    }
    targetBalance = targetBalance - check;
    await SmartWeave.kv.put(target, targetBalance);

    let callerBalance = await SmartWeave.kv.get(caller);
    callerBalance = callerBalance + check;
    await SmartWeave.kv.put(caller, callerBalance);

    await SmartWeave.kv.put('check.' + target + '.' + caller, 0);

    return {state};
  }

  if (input.function === 'transfer') {
    const target = input.target;
    const qty = input.qty;

    if (!Number.isInteger(qty)) {
      throw new ContractError('Invalid value for "qty". Must be an integer');
    }

    if (!target) {
      throw new ContractError('No target specified');
    }

    if (qty <= 0 || caller === target) {
      throw new ContractError('Invalid token transfer');
    }

    let callerBalance = await SmartWeave.kv.get(caller);
    callerBalance = callerBalance ? callerBalance : 0;

    if (callerBalance < qty) {
      throw new ContractError(`Caller balance not high enough to send ${qty} token(s)!`);
    }

    // Lower the token balance of the caller
    callerBalance -= qty;
    await SmartWeave.kv.put(caller, callerBalance);

    let targetBalance = await SmartWeave.kv.get(target);
    targetBalance = targetBalance ? targetBalance : 0;

    targetBalance += qty;
    await SmartWeave.kv.put(target, targetBalance);

    return {state};
  }

  if (input.function === 'balance') {
    const target = input.target;
    const ticker = state.ticker;

    if (typeof target !== 'string') {
      throw new ContractError('Must specify target to get balance for');
    }

    const result = await SmartWeave.kv.get(target);

    return {result: {target, ticker, balance: result ? result : 0}};
  }

  if (input.function === 'minted') {
    const sumMinted = (await SmartWeave.kv.entries({ gte: 'mint.', lte: 'mint.\xff'}))
      .reduce((acc, entry) => acc + parseInt(entry.value), 0)

    return {result: {minted: sumMinted}};
  }

  throw new ContractError(`No function supplied or function not recognised: "${input.function}"`);
}