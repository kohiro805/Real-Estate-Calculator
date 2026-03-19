// =============================================
// Codex Web — Main JS
// Ported from Chrome extension popup.js
// Uses localStorage instead of chrome.storage
// =============================================

const display = document.getElementById('display');
const calc = document.getElementById('calc-panel');
const buttons = Array.from(document.querySelectorAll('.btn'));

let current = '0';
let justEvaluated = false;
let previousExpression = '';
let constantOperator = null;
let constantValue = null;
const modeState = { mode: 'basic' };

// ---- Helpers ----
const toNumber = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

const roundTo = (value, dp = 2) => {
  const factor = 10 ** dp;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const pow = (base, exp) => Math.exp(exp * Math.log(base));

// ---- Finance Calculations ----
const calcAmortizationEqualPayment = (loanAmount, interestRate, loanTermYears) => {
  const P = toNumber(loanAmount);
  const r = toNumber(interestRate) / 12 / 100;
  const n = Math.max(1, Math.trunc(toNumber(loanTermYears) * 12));
  if (r === 0) {
    const pmt = roundTo(P / n, 2);
    return { monthlyPayment: pmt, totalPayment: roundTo(pmt * n, 2), totalInterest: roundTo(pmt * n - P, 2) };
  }
  const factor = (1 - pow(1 + r, -n));
  const monthlyPayment = roundTo((P * r) / factor, 2);
  const totalPayment = roundTo(monthlyPayment * n, 2);
  return { monthlyPayment, totalPayment, totalInterest: roundTo(totalPayment - P, 2) };
};

const calcMonthlyPayment = (loanAmount, rate, years) => {
  const P = toNumber(loanAmount);
  const r = toNumber(rate) / 12 / 100;
  const n = Math.max(1, Math.trunc(toNumber(years) * 12));
  if (r === 0) return roundTo(P / n, 2);
  const factor = 1 - pow(1 + r, -n);
  return roundTo((P * r) / factor, 2);
};

const calcLoanAmount = (monthlyPayment, rate, years) => {
  const pay = toNumber(monthlyPayment);
  const r = toNumber(rate) / 12 / 100;
  const n = Math.max(1, Math.trunc(toNumber(years) * 12));
  if (r === 0) return roundTo(pay * n, 2);
  const factor = 1 - pow(1 + r, -n);
  return roundTo((pay * factor) / r, 2);
};

const calcLoanTerm = (loanAmount, rate, monthlyPayment) => {
  const P = toNumber(loanAmount);
  const r = toNumber(rate) / 12 / 100;
  const PMT = toNumber(monthlyPayment);
  if (P <= 0 || PMT <= 0) return 0;
  if (r === 0) return P / PMT / 12;
  if (P * r >= PMT) return Infinity;
  const n = -Math.log(1 - (P * r / PMT)) / Math.log(1 + r);
  return n / 12;
};

// ---- Display / Calculator ----
const adjustFontSize = (element, maxFontSize, minFontSize) => {
  if (!element.textContent) return;
  element.style.whiteSpace = 'nowrap';
  element.style.wordBreak = 'normal';
  let currentSize = maxFontSize;
  element.style.fontSize = currentSize + 'px';
  while (element.scrollWidth > element.clientWidth && currentSize > minFontSize) {
    currentSize -= 1;
    element.style.fontSize = currentSize + 'px';
  }
  element.style.whiteSpace = 'pre-wrap';
  element.style.wordBreak = 'break-all';
};

const render = () => {
  const expDiv = calc.querySelector('#expression');
  const resDiv = calc.querySelector('#result');
  if (!expDiv || !resDiv) return;
  if (justEvaluated) {
    expDiv.textContent = previousExpression;
    resDiv.textContent = current;
  } else {
    expDiv.textContent = current;
    resDiv.textContent = '';
  }
  const kIndicator = calc.querySelector('#constant-indicator');
  if (kIndicator) kIndicator.classList.toggle('active', !!constantOperator);
  requestAnimationFrame(() => {
    if (expDiv.textContent) adjustFontSize(expDiv, justEvaluated ? 24 : 42, 12);
    if (resDiv.textContent) adjustFontSize(resDiv, 52, 16);
    const displayContainer = calc.querySelector('#display');
    if (displayContainer) displayContainer.scrollTop = displayContainer.scrollHeight;
  });
};

const append = (value) => {
  let normalizedValue = value;
  if (value === '*') normalizedValue = '×';
  if (value === '/') normalizedValue = '÷';
  const isOp = /[×÷+-]/.test(normalizedValue);
  if (justEvaluated) {
    if (/[0-9.]/.test(normalizedValue)) current = '0';
    justEvaluated = false;
  }
  if (isOp) {
    const lastChar = current.slice(-1);
    if (/[×÷+-]/.test(lastChar)) {
      if (lastChar === normalizedValue) {
        const valBefore = current.slice(0, -1);
        if (!Number.isNaN(Number(valBefore))) {
          constantOperator = normalizedValue;
          constantValue = valBefore;
          saveState(); return;
        }
      } else {
        constantOperator = null;
        constantValue = null;
        current = current.slice(0, -1) + normalizedValue;
        saveState(); return;
      }
    } else {
      if (constantOperator && constantOperator !== normalizedValue) {
        constantOperator = null;
        constantValue = null;
      }
    }
  }
  if (normalizedValue === '.') {
    const lastNumber = current.split(/[-+×÷]/).pop();
    if (lastNumber.includes('.')) return;
  }
  if (current.length >= 18) return;
  if (current === '0' && !/[×÷+.-]/.test(normalizedValue)) {
    current = normalizedValue;
  } else {
    current += normalizedValue;
  }
  saveState();
};

const clearAll = () => {
  current = '0';
  previousExpression = '';
  justEvaluated = false;
  constantOperator = null;
  constantValue = null;
  saveState();
};

const backspace = () => {
  if (justEvaluated) { clearAll(); render(); saveState(); return; }
  current = current.length > 1 ? current.slice(0, -1) : '0';
  saveState();
};

const formatResult = (num) => {
  const maxChars = 10;
  if (!Number.isFinite(num)) return 'Error';
  const raw = num.toString();
  if (raw.length <= maxChars) return raw;
  const intLen = Math.trunc(Math.abs(num)).toString().length + (num < 0 ? 1 : 0);
  if (intLen >= maxChars) return Math.trunc(num).toString().slice(0, maxChars);
  const decimals = Math.max(maxChars - intLen - 1, 0);
  const fixed = num.toFixed(decimals);
  if (fixed.length <= maxChars) return fixed;
  const ex = num.toExponential(Math.max(0, maxChars - 6));
  return ex.length <= maxChars ? ex : ex.slice(0, maxChars);
};

const replaceLastNumber = (fn) => {
  const match = current.match(/(-?\d*\.?\d+)(?!.*\d)/);
  if (match && match.index !== undefined) {
    const num = Number(match[1]);
    const next = fn(num);
    current = current.slice(0, match.index) + next.toString();
    return true;
  }
  if (!Number.isNaN(Number(current))) {
    current = fn(Number(current)).toString();
    return true;
  }
  return false;
};

const toggleSign = () => { replaceLastNumber((n) => -n); saveState(); };
const applyPercent = () => { replaceLastNumber((n) => roundTo(n / 100, 6)); saveState(); };

const tokenize = (expr) => {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === ' ') { i++; continue; }
    if ('()+*/'.includes(ch)) { tokens.push(ch); i++; continue; }
    if (ch === '-') {
      const isUnary = tokens.length === 0 || '+-*/('.includes(tokens[tokens.length - 1]);
      if (isUnary) {
        let j = i + 1;
        while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
        if (j === i + 1) throw new Error('invalid minus');
        tokens.push(expr.slice(i, j)); i = j; continue;
      }
      tokens.push(ch); i++; continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i; let dotCount = 0;
      while (j < expr.length && /[0-9.]/.test(expr[j])) {
        if (expr[j] === '.') dotCount++;
        if (dotCount > 1) throw new Error('dot');
        j++;
      }
      tokens.push(expr.slice(i, j)); i = j; continue;
    }
    throw new Error('char');
  }
  return tokens;
};

const evaluate = () => {
  if (constantOperator) {
    const k = Number(constantValue);
    const lastChar = current.slice(-1);
    let valToUse = /[×÷+-]/.test(lastChar) ? Number(current.slice(0, -1)) : Number(current);
    if (!Number.isNaN(valToUse)) {
      let res;
      switch (constantOperator) {
        case '+': res = valToUse + k; break;
        case '-': res = valToUse - k; break;
        case '×': res = valToUse * k; break;
        case '÷': res = k === 0 ? NaN : valToUse / k; break;
      }
      previousExpression = `${valToUse} ${constantOperator}${constantOperator}`;
      current = formatResult(res);
      justEvaluated = true;
      saveState(); render(); return;
    }
  }
  try {
    const normalized = current.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
    const tokens = tokenize(normalized);
    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
    const output = [], stack = [];
    const pushOperator = (op) => {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if ((top === '+' || top === '-' || top === '*' || top === '/') && precedence[top] >= precedence[op]) {
          output.push(stack.pop());
        } else break;
      }
      stack.push(op);
    };
    tokens.forEach((token) => {
      if (!Number.isNaN(Number(token))) { output.push(Number(token)); return; }
      if (token === '(') { stack.push(token); return; }
      if (token === ')') {
        while (stack.length && stack[stack.length - 1] !== '(') output.push(stack.pop());
        if (!stack.length) throw new Error('mismatch');
        stack.pop(); return;
      }
      pushOperator(token);
    });
    while (stack.length) {
      const op = stack.pop();
      if (op === '(' || op === ')') throw new Error('mismatch');
      output.push(op);
    }
    const evalPostfix = () => {
      const pile = [];
      output.forEach((item) => {
        if (typeof item === 'number') { pile.push(item); return; }
        const b = pile.pop(), a = pile.pop();
        if (a === undefined || b === undefined) throw new Error('operand');
        let res = 0;
        switch (item) {
          case '+': res = a + b; break;
          case '-': res = a - b; break;
          case '*': res = a * b; break;
          case '/': res = b === 0 ? NaN : a / b; break;
          default: throw new Error('op');
        }
        pile.push(res);
      });
      if (pile.length !== 1 || Number.isNaN(pile[0])) throw new Error('bad');
      return pile[0];
    };
    const result = evalPostfix();
    previousExpression = current + ' =';
    current = formatResult(result);
    justEvaluated = true;
    saveState();
  } catch {
    previousExpression = current + ' =';
    current = 'Error';
    justEvaluated = true;
    saveState();
  }
};

// ---- Mode / Tab Management ----
const bodyEl = document.body;
const loanPanel = document.getElementById('loan-panel');
const modeButtons = Array.from(document.querySelectorAll('.mode-btn'));
const loanTabs = Array.from(document.querySelectorAll('.loan-tab'));
const valuationTabs = Array.from(document.querySelectorAll('.valuation-tab'));

const loanInputs = {
  loanAmount: document.getElementById('loanAmount'),
  interestRate: document.getElementById('interestRate'),
  loanTerm: document.getElementById('loanTerm'),
  monthlyBudget: document.getElementById('monthlyBudget'),
  interestRate2: document.getElementById('interestRate2'),
  loanTerm2: document.getElementById('loanTerm2'),
  periodLoanAmount: document.getElementById('periodLoanAmount'),
  periodInterestRate: document.getElementById('periodInterestRate'),
  periodMonthlyPayment: document.getElementById('periodMonthlyPayment'),
};

const revenueInputs = {
  propPrice: document.getElementById('propPrice'),
  propDownPayment: document.getElementById('propDownPayment'),
  propInterest: document.getElementById('propInterest'),
  propTerm: document.getElementById('propTerm'),
  propAnnualRentFull: document.getElementById('propAnnualRentFull'),
  propOccupancy: document.getElementById('propOccupancy'),
  propExpRatio: document.getElementById('propExpRatio'),
  propExpectedYield: document.getElementById('propExpectedYield'),
};

const revenueOutputs = {
  outPropExpenses: document.getElementById('outPropExpenses'),
  outTotalCost: document.getElementById('outTotalCost'),
  outPropLoanAmount: document.getElementById('outPropLoanAmount'),
  outPropMonthlyPay: document.getElementById('outPropMonthlyPay'),
  outPropAnnualPay: document.getElementById('outPropAnnualPay'),
  outPropMonthlyRentEst: document.getElementById('outPropMonthlyRentEst'),
  outPropAnnualRentEst: document.getElementById('outPropAnnualRentEst'),
  outAnnualOpex: document.getElementById('outAnnualOpex'),
  outPropNOI: document.getElementById('outPropNOI'),
  outPropSalePrice: document.getElementById('outPropSalePrice'),
  outPropSaleProfit: document.getElementById('outPropSaleProfit'),
  outMonthlyCF: document.getElementById('outMonthlyCF'),
  outCF: document.getElementById('outCF'),
  outGrossYield: document.getElementById('outGrossYield'),
  outNOIYield: document.getElementById('outNOIYield'),
  outROI: document.getElementById('outROI'),
  outROE: document.getElementById('outROE'),
  outDSR: document.getElementById('outDSR'),
  outDSCR: document.getElementById('outDSCR'),
  outKPercent: document.getElementById('outKPercent'),
  outYieldGap: document.getElementById('outYieldGap'),
};

const loanOutputs = {
  monthlyPayment: document.getElementById('outMonthlyPayment'),
  loanPossible: document.getElementById('outLoanPossible'),
  periodResult: document.getElementById('outPeriodResult'),
};

const valuationInputs = {
  valPropPrice: document.getElementById('valPropPrice'),
  valRoadsideValue: document.getElementById('valRoadsideValue'),
  valLandArea: document.getElementById('valLandArea'),
  valLandCorrection: document.getElementById('valLandCorrection'),
  valStructure: document.getElementById('valStructure'),
  valFloorArea: document.getElementById('valFloorArea'),
  valBuildingAge: document.getElementById('valBuildingAge'),
};

const valuationSettings = {
  settingsLifeRC: document.getElementById('settingsLifeRC'),
  settingsPriceRC: document.getElementById('settingsPriceRC'),
  settingsLifeSteel: document.getElementById('settingsLifeSteel'),
  settingsPriceSteel: document.getElementById('settingsPriceSteel'),
  settingsLifeWood: document.getElementById('settingsLifeWood'),
  settingsPriceWood: document.getElementById('settingsPriceWood'),
};

const valuationOutputs = {
  outValRatio: document.getElementById('outValRatio'),
  outValTotal: document.getElementById('outValTotal'),
  outValLand: document.getElementById('outValLand'),
  outValBuilding: document.getElementById('outValBuilding'),
};

// ---- State Persistence (localStorage) ----
const saveState = () => {
  const state = {
    calculator: { current, previousExpression, justEvaluated },
    constants: { operator: constantOperator, value: constantValue },
    modes: { mode: modeState.mode, loanSubmode: bodyEl.dataset.loanSubmode, view: bodyEl.dataset.mode },
    loanInputs: Object.fromEntries(Object.entries(loanInputs).map(([k, v]) => [k, v?.value ?? ''])),
    revenueInputs: Object.fromEntries(Object.entries(revenueInputs).map(([k, v]) => [k, v?.value ?? ''])),
    valuationInputs: Object.fromEntries(Object.entries(valuationInputs).map(([k, v]) => [k, v?.value ?? ''])),
    valuationSettings: Object.fromEntries(Object.entries(valuationSettings).map(([k, v]) => [k, v?.value ?? ''])),
  };
  try { localStorage.setItem('codexState', JSON.stringify(state)); } catch (e) { /* ignore */ }
};

const loadState = () => {
  let state = null;
  try { state = JSON.parse(localStorage.getItem('codexState') || 'null'); } catch (e) { /* ignore */ }
  if (!state) {
    setLoanSubmode('payment');
    setMode('basic');
    return;
  }
  if (state.calculator) {
    current = state.calculator.current || '0';
    previousExpression = state.calculator.previousExpression || '';
    justEvaluated = state.calculator.justEvaluated || false;
  }
  if (state.constants) { constantOperator = state.constants.operator || null; constantValue = state.constants.value || null; }
  render();
  if (state.loanInputs) Object.keys(state.loanInputs).forEach(k => { if (loanInputs[k]) loanInputs[k].value = state.loanInputs[k]; });
  if (state.revenueInputs) Object.keys(state.revenueInputs).forEach(k => { if (revenueInputs[k]) revenueInputs[k].value = state.revenueInputs[k]; });
  if (state.valuationInputs) Object.keys(state.valuationInputs).forEach(k => { if (valuationInputs[k]) valuationInputs[k].value = state.valuationInputs[k]; });
  if (state.valuationSettings) Object.keys(state.valuationSettings).forEach(k => { if (valuationSettings[k]) valuationSettings[k].value = state.valuationSettings[k]; });
  updateLoanOutputs(); updateRevenueOutputs(); updateValuationOutputs();
  if (state.modes) {
    if (state.modes.loanSubmode) setLoanSubmode(state.modes.loanSubmode);
    if (state.modes.mode) setMode(state.modes.mode);
  } else {
    setLoanSubmode('payment'); setMode('basic');
  }
};

// ---- Mode Setters ----
const setMode = (mode) => {
  modeState.mode = mode;
  let view = 'normal';
  if (mode === 'realEstate') view = 'loan';
  else if (mode === 'revenue') view = 'revenue';
  else if (mode === 'valuation') view = 'valuation';
  bodyEl.dataset.mode = view;
  modeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === view));
  if (view === 'revenue') updateRevenueOutputs();
  if (view === 'valuation') updateValuationOutputs();
  saveState();
};

const setLoanSubmode = (sub) => {
  bodyEl.dataset.loanSubmode = sub;
  loanTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.loanTab === sub));
  saveState();
};

const setValuationSubmode = (sub) => {
  valuationTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.valuationTab === sub));
  document.querySelectorAll('.valuation-section').forEach(sec => {
    sec.style.display = sec.dataset.valuationTabContent === sub ? 'block' : 'none';
  });
  saveState();
};

// ---- Output Updaters ----
const updateLoanOutputs = () => {
  const loanAmount = toNumber(loanInputs.loanAmount.value);
  const interestRate = toNumber(loanInputs.interestRate.value);
  const term = toNumber(loanInputs.loanTerm.value);
  const budget = toNumber(loanInputs.monthlyBudget.value);
  const rate2 = toNumber(loanInputs.interestRate2.value || loanInputs.interestRate.value);
  const term2 = toNumber(loanInputs.loanTerm2.value || loanInputs.loanTerm.value);
  const pLoanAmount = toNumber(loanInputs.periodLoanAmount.value);
  const pInterestRate = toNumber(loanInputs.periodInterestRate.value);
  const pMonthlyPayment = toNumber(loanInputs.periodMonthlyPayment.value);

  const amort = calcAmortizationEqualPayment(loanAmount, interestRate, term);
  const possible = calcLoanAmount(budget, rate2, term2);
  const periodYears = calcLoanTerm(pLoanAmount, pInterestRate, pMonthlyPayment);

  loanOutputs.monthlyPayment.textContent = Number.isFinite(amort.monthlyPayment) ? Math.round(amort.monthlyPayment).toLocaleString() : '-';
  loanOutputs.loanPossible.textContent = Number.isFinite(possible) ? Math.round(possible).toLocaleString() : '-';

  if (periodYears === Infinity || Number.isNaN(periodYears)) {
    loanOutputs.periodResult.textContent = '返済不可';
  } else if (periodYears > 0) {
    const totalMonths = Math.ceil(periodYears * 12);
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    loanOutputs.periodResult.textContent = y === 0 ? `${m} ヶ月` : m === 0 ? `${y} 年` : `${y} 年 ${m} ヶ月`;
  } else {
    loanOutputs.periodResult.textContent = '-';
  }
};

const updateRevenueOutputs = () => {
  const price = toNumber(revenueInputs.propPrice.value);
  const down = toNumber(revenueInputs.propDownPayment.value);
  const rate = toNumber(revenueInputs.propInterest.value);
  const term = toNumber(revenueInputs.propTerm.value);
  const annualRentFull = toNumber(revenueInputs.propAnnualRentFull.value);
  const occ = toNumber(revenueInputs.propOccupancy.value) / 100;
  const expRatio = toNumber(revenueInputs.propExpRatio.value) / 100;

  const purchaseExpenses = price * 0.08;
  const totalCost = price + purchaseExpenses;
  const loanAmt = Math.max(0, price - down);
  const monthlyPay = calcMonthlyPayment(loanAmt, rate, term);
  const annualPay = monthlyPay * 12;
  const monthlyRentFull = annualRentFull / 12;
  const monthlyRentEst = monthlyRentFull * occ;
  const annualOpex = annualRentFull * expRatio;
  const ei = annualRentFull * occ;
  const noi = ei - annualOpex;
  const annualCF = noi - annualPay;
  const monthlyCF = annualCF / 12;
  const expectedYield = parseFloat(revenueInputs.propExpectedYield.value) || 0;
  const salePrice = (expectedYield > 0 && annualRentFull > 0) ? (annualRentFull / (expectedYield / 100)) * 0.95 : 0;
  const saleProfit = salePrice > 0 ? salePrice - loanAmt : 0;
  const grossYield = price > 0 ? (annualRentFull / price) * 100 : 0;
  const noiYield = price > 0 ? (noi / price) * 100 : 0;
  const roi = totalCost > 0 ? (annualCF / totalCost) * 100 : 0;
  const roeDenominator = down + purchaseExpenses;
  const roe = roeDenominator > 0 ? (annualCF / roeDenominator) * 100 : 0;
  const dsr = monthlyRentFull > 0 ? (monthlyPay / monthlyRentFull) * 100 : 0;
  const dscr = annualPay > 0 ? noi / annualPay : 0;
  const kPercent = loanAmt > 0 ? (annualPay / loanAmt) * 100 : 0;
  const yieldGap = noiYield - kPercent;

  const updateColor = (el, val) => {
    if (!el) return;
    if (val < 0) { el.classList.add('red-highlight'); el.classList.remove('blue-highlight'); }
    else if (val > 0) { el.classList.add('blue-highlight'); el.classList.remove('red-highlight'); }
    else { el.classList.remove('red-highlight', 'blue-highlight'); }
  };

  revenueOutputs.outPropExpenses.textContent = purchaseExpenses !== 0 ? Math.round(purchaseExpenses).toLocaleString() : '-';
  revenueOutputs.outTotalCost.textContent = totalCost !== 0 ? Math.round(totalCost).toLocaleString() : '-';
  revenueOutputs.outPropLoanAmount.textContent = loanAmt !== 0 ? Math.round(loanAmt).toLocaleString() : '-';
  revenueOutputs.outPropMonthlyPay.textContent = monthlyPay !== 0 ? Math.round(monthlyPay).toLocaleString() : '-';
  revenueOutputs.outPropAnnualPay.textContent = annualPay !== 0 ? Math.round(annualPay).toLocaleString() : '-';
  revenueOutputs.outPropMonthlyRentEst.textContent = monthlyRentEst !== 0 ? Math.round(monthlyRentEst).toLocaleString() : '-';
  revenueOutputs.outPropAnnualRentEst.textContent = ei !== 0 ? Math.round(ei).toLocaleString() : '-';
  revenueOutputs.outAnnualOpex.textContent = annualOpex !== 0 ? Math.round(annualOpex).toLocaleString() : '-';
  revenueOutputs.outPropNOI.textContent = noi !== 0 ? Math.round(noi).toLocaleString() : '-';
  revenueOutputs.outPropSalePrice.textContent = salePrice !== 0 ? Math.round(salePrice).toLocaleString() : '-';
  revenueOutputs.outPropSaleProfit.textContent = saleProfit !== 0 ? Math.round(saleProfit).toLocaleString() : '-';
  updateColor(revenueOutputs.outPropSaleProfit, saleProfit);
  revenueOutputs.outMonthlyCF.textContent = monthlyCF !== 0 ? Math.round(monthlyCF).toLocaleString() : '-';
  updateColor(revenueOutputs.outMonthlyCF, monthlyCF);
  revenueOutputs.outCF.textContent = annualCF !== 0 ? Math.round(annualCF).toLocaleString() : '-';
  updateColor(revenueOutputs.outCF, annualCF);
  revenueOutputs.outGrossYield.textContent = (grossYield !== 0 || annualRentFull > 0) ? grossYield.toFixed(2) + '%' : '-';
  revenueOutputs.outNOIYield.textContent = (noiYield !== 0 || noi !== 0) ? noiYield.toFixed(2) + '%' : '-';
  revenueOutputs.outROI.textContent = (roi !== 0 || annualCF !== 0) ? roi.toFixed(2) + '%' : '-';
  revenueOutputs.outROE.textContent = (roe !== 0 || annualCF !== 0) ? roe.toFixed(2) + '%' : '-';
  revenueOutputs.outDSR.textContent = (dsr !== 0 || monthlyPay !== 0) ? dsr.toFixed(2) + '%' : '-';
  revenueOutputs.outDSCR.textContent = (dscr !== 0 || noi !== 0) ? dscr.toFixed(2) : '-';
  revenueOutputs.outKPercent.textContent = (kPercent !== 0 || annualPay !== 0) ? kPercent.toFixed(2) + '%' : '-';
  revenueOutputs.outYieldGap.textContent = (yieldGap !== 0 || noiYield !== 0 || kPercent !== 0) ? yieldGap.toFixed(2) + '%' : '-';
};

const updateValuationOutputs = () => {
  const struct = valuationInputs.valStructure.value;
  let life = 0, recPrice = 0;
  if (struct === 'rc') {
    life = toNumber(valuationSettings.settingsLifeRC.value || 47);
    recPrice = toNumber(valuationSettings.settingsPriceRC.value || 242000);
  } else if (struct === 'steel') {
    life = toNumber(valuationSettings.settingsLifeSteel.value || 34);
    recPrice = toNumber(valuationSettings.settingsPriceSteel.value || 180000);
  } else {
    life = toNumber(valuationSettings.settingsLifeWood.value || 22);
    recPrice = toNumber(valuationSettings.settingsPriceWood.value || 150000);
  }
  const roadside = toNumber(valuationInputs.valRoadsideValue.value);
  const landArea = toNumber(valuationInputs.valLandArea.value);
  const landCorr = toNumber(valuationInputs.valLandCorrection.value || 100) / 100;
  const landVal = roadside * landArea * landCorr;
  const floorArea = toNumber(valuationInputs.valFloorArea.value);
  const age = toNumber(valuationInputs.valBuildingAge.value);
  const remainingLife = Math.max(0, life - age);
  const buildingVal = floorArea * recPrice * (remainingLife / life);
  const totalVal = landVal + buildingVal;
  const propPrice = toNumber(valuationInputs.valPropPrice.value);
  const ratio = propPrice > 0 ? (totalVal / propPrice) * 100 : 0;
  valuationOutputs.outValLand.textContent = landVal !== 0 ? Math.round(landVal).toLocaleString() : '-';
  valuationOutputs.outValBuilding.textContent = buildingVal !== 0 ? Math.round(buildingVal).toLocaleString() : '-';
  valuationOutputs.outValTotal.textContent = totalVal !== 0 ? Math.round(totalVal).toLocaleString() : '-';
  valuationOutputs.outValRatio.textContent = (ratio !== 0 || totalVal > 0) ? ratio.toFixed(2) + '%' : '-';
};

// ---- Event Listeners ----
buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    const value = btn.dataset.value;
    const action = btn.dataset.action;
    btn.blur();
    if (action === 'clear') clearAll();
    else if (action === 'delete') backspace();
    else if (action === 'toggle-sign') toggleSign();
    else if (action === 'percent') applyPercent();
    else if (action === 'equals') evaluate();
    else if (value) append(value);
    render();
  });
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (modeState.mode !== 'basic') return;
  const key = e.key;
  if (/[0-9]/.test(key) || /[+*/.-]/.test(key)) { e.preventDefault(); append(key); render(); }
  else if (key === 'Enter' || key === '=') { e.preventDefault(); evaluate(); render(); }
  else if (key === 'Backspace') { e.preventDefault(); backspace(); render(); }
  else if (key === 'Escape' || key.toLowerCase() === 'c') { e.preventDefault(); clearAll(); render(); }
  else if (key === 'Delete') { e.preventDefault(); current = '0'; render(); saveState(); }
});

modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.mode;
    let internalMode = 'basic';
    if (target === 'loan') internalMode = 'realEstate';
    else if (target === 'revenue') internalMode = 'revenue';
    else if (target === 'valuation') internalMode = 'valuation';
    setMode(internalMode);
    if (internalMode === 'realEstate') setLoanSubmode(bodyEl.dataset.loanSubmode || 'payment');
  });
});

loanTabs.forEach(btn => btn.addEventListener('click', () => setLoanSubmode(btn.dataset.loanTab)));
valuationTabs.forEach(btn => btn.addEventListener('click', () => setValuationSubmode(btn.dataset.valuationTab)));

[...Object.values(loanInputs), ...Object.values(revenueInputs)].forEach(input => {
  input?.addEventListener('input', () => { updateLoanOutputs(); updateRevenueOutputs(); saveState(); });
});
[...Object.values(valuationInputs), ...Object.values(valuationSettings)].forEach(input => {
  input?.addEventListener('input', () => { updateValuationOutputs(); saveState(); });
});

// ---- Cursor Glow Effect ----
const addGlow = (el) => {
  if (!el) return;
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--cursor-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--cursor-y', `${e.clientY - rect.top}px`);
    el.style.setProperty('--cursor-active', '1');
  });
  el.addEventListener('mouseleave', () => el.style.setProperty('--cursor-active', '0'));
};
addGlow(calc);
addGlow(loanPanel);
addGlow(document.getElementById('revenue-panel'));
addGlow(document.getElementById('valuation-panel'));

// ---- Initialise ----
loadState();
render();
