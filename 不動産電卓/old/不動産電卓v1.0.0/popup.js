(() => {
  const display = document.getElementById('display');
  const calc = document.querySelector('.calculator');
  const buttons = Array.from(document.querySelectorAll('.btn'));

  let current = '0';
  let justEvaluated = false;
  let previousExpression = '';
  let constantOperator = null; // '+', '-', '×', '÷'
  let constantValue = null;
  let lastOperatorPressed = null;
  const modeState = { mode: 'basic' }; // basic | realEstate
  const financeState = {
    loanAmount: 0,
    interestRate: 0,
    loanTerm: 0,
    monthlyRent: 0,
    monthlyExpenses: 0,
    annualExpenses: 0,
    propertyPrice: 0,
    annualNOI: 0,
    annualDebtService: 0,
    vacancyRate: 0
  };

  const toNumber = (val) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  const roundTo = (value, dp = 2) => {
    const factor = 10 ** dp;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  };

  const pow = (base, exp) => Math.exp(exp * Math.log(base));

  const calcAmortizationEqualPayment = (loanAmount, interestRate, loanTermYears) => {
    const P = toNumber(loanAmount);
    const r = toNumber(interestRate) / 12 / 100;
    const n = Math.max(1, Math.trunc(toNumber(loanTermYears) * 12));
    if (r === 0) {
      const pmt = roundTo(P / n, 2);
      return {
        monthlyPayment: pmt,
        totalPayment: roundTo(pmt * n, 2),
        totalInterest: roundTo(pmt * n - P, 2)
      };
    }
    const factor = (1 - pow(1 + r, -n));
    const monthlyPayment = roundTo((P * r) / factor, 2);
    const totalPayment = roundTo(monthlyPayment * n, 2);
    return {
      monthlyPayment,
      totalPayment,
      totalInterest: roundTo(totalPayment - P, 2)
    };
  };

  const calcCashFlow = (monthlyRent, monthlyLoanPayment, monthlyExpenses) => {
    const mRent = toNumber(monthlyRent);
    const mLoan = toNumber(monthlyLoanPayment);
    const mExp = toNumber(monthlyExpenses);
    const monthlyCashFlow = roundTo(mRent - mLoan - mExp, 2);
    return {
      monthlyCashFlow,
      annualCashFlow: roundTo(monthlyCashFlow * 12, 2)
    };
  };

  const calcGrossYield = (annualRent, propertyPrice) => {
    const rent = toNumber(annualRent);
    const price = toNumber(propertyPrice);
    if (price === 0) return { grossYield: 0 };
    return { grossYield: roundTo((rent / price) * 100, 2) };
  };

  const calcNetYield = (annualRent, annualExpenses, propertyPrice) => {
    const rent = toNumber(annualRent);
    const exp = toNumber(annualExpenses);
    const price = toNumber(propertyPrice);
    if (price === 0) return { netYield: 0 };
    return { netYield: roundTo(((rent - exp) / price) * 100, 2) };
  };

  const calcDSCR = (annualNOI, annualDebtService) => {
    const noi = toNumber(annualNOI);
    const debt = toNumber(annualDebtService);
    if (debt === 0) return { DSCR: Infinity };
    return { DSCR: roundTo(noi / debt, 2) };
  };

  const calcLTV = (loanAmount, propertyPrice) => {
    const loan = toNumber(loanAmount);
    const price = toNumber(propertyPrice);
    if (price === 0) return { LTV: 0 };
    return { LTV: roundTo((loan / price) * 100, 2) };
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
    // If interest alone exceeds or equals the monthly payment, it can never be paid off
    if (P * r >= PMT) return Infinity;
    const n = -Math.log(1 - (P * r / PMT)) / Math.log(1 + r);
    return n / 12; // Return in years
  };

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
    if (kIndicator) {
      kIndicator.classList.toggle('active', !!constantOperator);
    }

    requestAnimationFrame(() => {
      if (expDiv.textContent) adjustFontSize(expDiv, justEvaluated ? 24 : 42, 12);
      if (resDiv.textContent) adjustFontSize(resDiv, 52, 16);
      
      const displayContainer = calc.querySelector('#display');
      if (displayContainer) {
        displayContainer.scrollTop = displayContainer.scrollHeight;
      }
    });
  };

  const append = (value) => {
    // Normalize operators for consistent display and evaluation
    let normalizedValue = value;
    if (value === '*') normalizedValue = '×';
    if (value === '/') normalizedValue = '÷';

    const isOp = /[×÷+-]/.test(normalizedValue);

    if (justEvaluated) {
      if (/[0-9.]/.test(normalizedValue)) {
        current = '0';
      }
      justEvaluated = false;
    }

    if (isOp) {
      const lastChar = current.slice(-1);
      if (/[×÷+-]/.test(lastChar)) {
        if (lastChar === normalizedValue) {
          // Double press: Set constant mode
          const valBefore = current.slice(0, -1);
          if (!Number.isNaN(Number(valBefore))) {
            constantOperator = normalizedValue;
            constantValue = valBefore;
            saveState();
            return;
          }
        } else {
          // Different operator: clear constant and replace operator
          constantOperator = null;
          constantValue = null;
          current = current.slice(0, -1) + normalizedValue;
          saveState();
          return;
        }
      } else {
        // Single operator press: handle potential clear condition
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
    if (justEvaluated) {
      clearAll();
      render();
      saveState();
      return;
    }
    current = current.length > 1 ? current.slice(0, -1) : '0';
    saveState();
  };

  const saveState = () => {
    const state = {
      calculator: { current, previousExpression, justEvaluated },
      constants: { operator: constantOperator, value: constantValue },
      modes: {
        mode: modeState.mode,
        loanSubmode: bodyEl.dataset.loanSubmode,
        view: bodyEl.dataset.mode
      },
      loanInputs: {
        loanAmount: loanInputs.loanAmount.value,
        interestRate: loanInputs.interestRate.value,
        loanTerm: loanInputs.loanTerm.value,
        monthlyBudget: loanInputs.monthlyBudget.value,
        interestRate2: loanInputs.interestRate2.value,
        loanTerm2: loanInputs.loanTerm2.value,
        periodLoanAmount: loanInputs.periodLoanAmount.value,
        periodInterestRate: loanInputs.periodInterestRate.value,
        periodMonthlyPayment: loanInputs.periodMonthlyPayment.value
      },
      revenueInputs: {
        propPrice: revenueInputs.propPrice.value,
        propDownPayment: revenueInputs.propDownPayment.value,
        propInterest: revenueInputs.propInterest.value,
        propTerm: revenueInputs.propTerm.value,
        propAnnualRentFull: revenueInputs.propAnnualRentFull.value,
        propOccupancy: revenueInputs.propOccupancy.value,
        propExpRatio: revenueInputs.propExpRatio.value,
        propExpectedYield: revenueInputs.propExpectedYield.value
      },
      valuationInputs: {
        valPropPrice: valuationInputs.valPropPrice.value,
        valRoadsideValue: valuationInputs.valRoadsideValue.value,
        valLandArea: valuationInputs.valLandArea.value,
        valLandCorrection: valuationInputs.valLandCorrection.value,
        valStructure: valuationInputs.valStructure.value,
        valFloorArea: valuationInputs.valFloorArea.value,
        valBuildingAge: valuationInputs.valBuildingAge.value
      },
      valuationSettings: {
        settingsLifeRC: valuationSettings.settingsLifeRC.value,
        settingsPriceRC: valuationSettings.settingsPriceRC.value,
        settingsLifeSteel: valuationSettings.settingsLifeSteel.value,
        settingsPriceSteel: valuationSettings.settingsPriceSteel.value,
        settingsLifeWood: valuationSettings.settingsLifeWood.value,
        settingsPriceWood: valuationSettings.settingsPriceWood.value
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ calculatorState: state });
    }
  };

  const loadState = () => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      // If storage is unavailable, just set initial state
      setLoanSubmode(bodyEl.dataset.loanSubmode || 'payment');
      setMode(bodyEl.dataset.mode === 'loan' ? 'realEstate' : 'basic');
      return;
    }

    chrome.storage.local.get(['calculatorState'], (result) => {
      const state = result.calculatorState;
      if (!state) {
        // First run or no state saved, set defaults
        setLoanSubmode(bodyEl.dataset.loanSubmode || 'payment');
        setMode(bodyEl.dataset.mode === 'loan' ? 'realEstate' : 'basic');
        return;
      }

      // Restore basic calculator
      if (state.calculator) {
        current = state.calculator.current || '0';
        previousExpression = state.calculator.previousExpression || '';
        justEvaluated = state.calculator.justEvaluated || false;
      }

      // Restore constants
      if (state.constants) {
        constantOperator = state.constants.operator || null;
        constantValue = state.constants.value || null;
      }
      render();

      // Restore inputs
      if (state.loanInputs) {
        Object.keys(state.loanInputs).forEach(key => {
          if (loanInputs[key]) loanInputs[key].value = state.loanInputs[key];
        });
        updateLoanOutputs();
      }
      if (state.revenueInputs) {
        Object.keys(state.revenueInputs).forEach(key => {
          if (revenueInputs[key]) revenueInputs[key].value = state.revenueInputs[key];
        });
        updateRevenueOutputs();
      }
      if (state.valuationInputs) {
        Object.keys(state.valuationInputs).forEach(key => {
          if (valuationInputs[key]) valuationInputs[key].value = state.valuationInputs[key];
        });
      }
      if (state.valuationSettings) {
        Object.keys(state.valuationSettings).forEach(key => {
          if (valuationSettings[key]) valuationSettings[key].value = state.valuationSettings[key];
        });
      }
      updateValuationOutputs();

      // Restore modes
      if (state.modes) {
        if (state.modes.loanSubmode) setLoanSubmode(state.modes.loanSubmode);
        if (state.modes.mode) setMode(state.modes.mode);
      } else {
        // Fallback defaults
        setLoanSubmode(bodyEl.dataset.loanSubmode || 'payment');
        setMode(bodyEl.dataset.mode === 'loan' ? 'realEstate' : 'basic');
      }
    });
  };

  const tokenize = (expr) => {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (ch === ' ') { i += 1; continue; }
      if ('()+*/'.includes(ch)) { tokens.push(ch); i += 1; continue; }
      if (ch === '-') {
        const isUnary = tokens.length === 0 || ('+-*/('.includes(tokens[tokens.length - 1]));
        if (isUnary) {
          let j = i + 1;
          while (j < expr.length && /[0-9.]/.test(expr[j])) j += 1;
          if (j === i + 1) throw new Error('invalid minus');
          tokens.push(expr.slice(i, j));
          i = j;
          continue;
        }
        tokens.push(ch);
        i += 1;
        continue;
      }
      if (/[0-9.]/.test(ch)) {
        let j = i;
        let dotCount = 0;
        while (j < expr.length && /[0-9.]/.test(expr[j])) {
          if (expr[j] === '.') dotCount += 1;
          if (dotCount > 1) throw new Error('dot');
          j += 1;
        }
        tokens.push(expr.slice(i, j));
        i = j;
        continue;
      }
      throw new Error('char');
    }
    return tokens;
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

    const exp = num.toExponential(Math.max(0, maxChars - 6));
    return exp.length <= maxChars ? exp : exp.slice(0, maxChars);
  };

  const replaceLastNumber = (fn) => {
    const match = current.match(/(-?\\d*\\.?\\d+)(?!.*\\d)/);
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

  const toggleSign = () => {
    replaceLastNumber((n) => -n);
    saveState();
  };

  const applyPercent = () => {
    replaceLastNumber((n) => roundTo(n / 100, 6));
    saveState();
  };

  const evaluate = () => {
    if (constantOperator) {
      const k = Number(constantValue);
      let valToUse;
      
      const lastChar = current.slice(-1);
      if (/[×÷+-]/.test(lastChar)) {
        // User pressed = immediately after Op Op or after a number + Op
        valToUse = Number(current.slice(0, -1));
      } else {
        valToUse = Number(current);
      }

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
        saveState();
        render();
        return;
      }
    }

    try {
      const normalized = current.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
      const tokens = tokenize(normalized);

      const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
      const output = [];
      const stack = [];

      const pushOperator = (op) => {
        while (stack.length) {
          const top = stack[stack.length - 1];
          if ((top === '+' || top === '-' || top === '*' || top === '/') && precedence[top] >= precedence[op]) {
            output.push(stack.pop());
          } else {
            break;
          }
        }
        stack.push(op);
      };

      tokens.forEach((token, idx) => {
        if (!Number.isNaN(Number(token))) {
          output.push(Number(token));
          return;
        }

        if (token === '(') {
          stack.push(token);
          return;
        }

        if (token === ')') {
          while (stack.length && stack[stack.length - 1] !== '(') {
            output.push(stack.pop());
          }
          if (!stack.length) throw new Error('mismatch');
          stack.pop();
          return;
        }

        // operator
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
          if (typeof item === 'number') {
            pile.push(item);
            return;
          }
          const b = pile.pop();
          const a = pile.pop();
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

  buttons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const value = btn.dataset.value;
      const action = btn.dataset.action;

      // Blur the button to return focus to the document and prevent keyboard interference
      btn.blur();

      if (action === 'clear') {
        clearAll();
      } else if (action === 'delete') {
        backspace();
      } else if (action === 'toggle-sign') {
        toggleSign();
      } else if (action === 'percent') {
        applyPercent();
      } else if (action === 'equals') {
        evaluate();
      } else if (value) {
        append(value);
      }

      render();
    });
  });

  document.addEventListener('keydown', (e) => {
    // Ignore keyboard input if focus is in an input element (prevent doubling/interference)
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    // Only allow calculator shortcuts when in basic mode
    if (modeState.mode !== 'basic') {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
        // Allow mode toggle via shortcut even if not in basic
      } else {
        return; 
      }
    }

    // Map keyboard keys to calculator actions
    const key = e.key;
    const isNumber = /[0-9]/.test(key);
    const isOperator = /[+*/.-]/.test(key); // Fixed regex range to be safe

    if (isNumber || isOperator) {
      e.preventDefault();
      append(key);
      render();
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      evaluate();
      render();
    } else if (key === 'Backspace') {
      e.preventDefault();
      backspace();
      render();
    } else if (key === 'Escape' || key.toLowerCase() === 'c' || key === 'Clear') {
      e.preventDefault();
      clearAll();
      render();
    } else if (key === 'Delete') {
      e.preventDefault();
      current = '0';
      render();
      saveState();
    } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      modeState.mode = modeState.mode === 'basic' ? 'realEstate' : 'basic';
      calc.dataset.mode = modeState.mode;
    }
  });

  const modeButtons = Array.from(document.querySelectorAll('.mode-btn'));
  const bodyEl = document.body;
  const loanPanel = document.querySelector('.loan-panel');
  const normalCalc = calc;
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
    propExpectedYield: document.getElementById('propExpectedYield')
  };
  const revenueOutputs = {
    // Current Auto-Calculated Intermediate values
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
    // Analysis Results
    outMonthlyCF: document.getElementById('outMonthlyCF'),
    outCF: document.getElementById('outCF'), // Annual CF
    outGrossYield: document.getElementById('outGrossYield'),
    outNOIYield: document.getElementById('outNOIYield'),
    outROI: document.getElementById('outROI'),
    outROE: document.getElementById('outROE'),
    outDSR: document.getElementById('outDSR'),
    outDSCR: document.getElementById('outDSCR'),
    outKPercent: document.getElementById('outKPercent'),
    outYieldGap: document.getElementById('outYieldGap')
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
    valBuildingAge: document.getElementById('valBuildingAge')
  };
  const valuationSettings = {
    settingsLifeRC: document.getElementById('settingsLifeRC'),
    settingsPriceRC: document.getElementById('settingsPriceRC'),
    settingsLifeSteel: document.getElementById('settingsLifeSteel'),
    settingsPriceSteel: document.getElementById('settingsPriceSteel'),
    settingsLifeWood: document.getElementById('settingsLifeWood'),
    settingsPriceWood: document.getElementById('settingsPriceWood')
  };
  const valuationOutputs = {
    outValRatio: document.getElementById('outValRatio'),
    outValTotal: document.getElementById('outValTotal'),
    outValLand: document.getElementById('outValLand'),
    outValBuilding: document.getElementById('outValBuilding')
  };
  const loanTabs = Array.from(document.querySelectorAll('.loan-tab'));
  const valuationTabs = Array.from(document.querySelectorAll('.valuation-tab'));

  const setMode = (mode) => {
    modeState.mode = mode;
    let view = 'normal';
    if (mode === 'realEstate') view = 'loan';
    else if (mode === 'revenue') view = 'revenue';
    else if (mode === 'valuation') view = 'valuation';
    
    bodyEl.dataset.mode = view;
    modeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === view);
    });

    if (view === 'revenue') {
      bodyEl.style.width = '800px';
    } else if (view === 'valuation') {
      bodyEl.style.width = '540px';
    } else {
      bodyEl.style.width = '340px';
    }

    if (view === 'normal') {
      normalCalc.style.display = 'grid';
      loanPanel.style.display = 'none';
      document.querySelector('.revenue-panel').style.display = 'none';
      document.querySelector('.valuation-panel').style.display = 'none';
    } else if (view === 'loan') {
      normalCalc.style.display = 'none';
      loanPanel.style.display = 'block';
      document.querySelector('.revenue-panel').style.display = 'none';
      document.querySelector('.valuation-panel').style.display = 'none';
      bodyEl.dataset.loanSubmode = bodyEl.dataset.loanSubmode || 'payment';
    } else if (view === 'revenue') {
      normalCalc.style.display = 'none';
      loanPanel.style.display = 'none';
      document.querySelector('.revenue-panel').style.display = 'grid';
      document.querySelector('.valuation-panel').style.display = 'none';
      updateRevenueOutputs();
    } else {
      normalCalc.style.display = 'none';
      loanPanel.style.display = 'none';
      document.querySelector('.revenue-panel').style.display = 'none';
      document.querySelector('.valuation-panel').style.display = 'grid';
      updateValuationOutputs();
    }
    saveState();
  };

  const setValuationSubmode = (sub) => {
    valuationTabs.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.valuationTab === sub);
    });
    document.querySelectorAll('.valuation-section').forEach(sec => {
      sec.style.display = sec.dataset.valuationTabContent === sub ? 'block' : 'none';
    });
    saveState();
  };

  valuationTabs.forEach(btn => {
    btn.addEventListener('click', () => setValuationSubmode(btn.dataset.valuationTab));
  });

  const setLoanSubmode = (sub) => {
    bodyEl.dataset.loanSubmode = sub;
    loanTabs.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.loanTab === sub);
    });
    saveState();
  };

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

    loanOutputs.monthlyPayment.textContent = Number.isFinite(amort.monthlyPayment)
      ? Math.round(amort.monthlyPayment).toLocaleString()
      : '-';
    loanOutputs.loanPossible.textContent = Number.isFinite(possible)
      ? Math.round(possible).toLocaleString()
      : '-';

    if (periodYears === Infinity || Number.isNaN(periodYears)) {
      loanOutputs.periodResult.textContent = '返済不可';
    } else if (periodYears > 0) {
      const totalMonths = Math.ceil(periodYears * 12);
      const y = Math.floor(totalMonths / 12);
      const m = totalMonths % 12;
      if (y === 0) {
        loanOutputs.periodResult.textContent = `${m} ヶ月`;
      } else if (m === 0) {
        loanOutputs.periodResult.textContent = `${y} 年`;
      } else {
        loanOutputs.periodResult.textContent = `${y} 年 ${m} ヶ月`;
      }
    } else {
      loanOutputs.periodResult.textContent = '-';
    }
  };

  const updateRevenueOutputs = () => {
    // Inputs
    const price = toNumber(revenueInputs.propPrice.value);
    const down = toNumber(revenueInputs.propDownPayment.value);
    const rate = toNumber(revenueInputs.propInterest.value);
    const term = toNumber(revenueInputs.propTerm.value);
    const annualRentFull = toNumber(revenueInputs.propAnnualRentFull.value);
    const occ = toNumber(revenueInputs.propOccupancy.value) / 100;
    const expRatio = toNumber(revenueInputs.propExpRatio.value) / 100;

    // 1. Purchase Calculations
    const purchaseExpenses = price * 0.08;
    const totalCost = price + purchaseExpenses;
    const loanAmt = Math.max(0, price - down);
    const monthlyPay = calcMonthlyPayment(loanAmt, rate, term);
    const annualPay = monthlyPay * 12;
    
    // 2. Operating Calculations
    const monthlyRentFull = annualRentFull / 12;
    const monthlyRentEst = monthlyRentFull * occ;
    const annualOpex = annualRentFull * expRatio;
    const monthlyOpex = annualOpex / 12;
    
    // 3. Analysis Results Calculations
    const ei = annualRentFull * occ; // Effective Income (= 想定年額家賃)
    const noi = ei - annualOpex;      // 実質収益
    const annualCF = noi - annualPay; // 年額ローン返済後CF
    const monthlyCF = annualCF / 12;  // 月額ローン返済後CF
    
    // 3.5 Exit Simulation (Sale)
    const expectedYield = parseFloat(revenueInputs.propExpectedYield.value) || 0;
    const salePrice = (expectedYield > 0 && annualRentFull > 0) ? (annualRentFull / (expectedYield / 100)) * 0.95 : 0;
    const saleProfit = salePrice > 0 ? salePrice - loanAmt : 0;

    // 4. Yields & Ratios
    const grossYield = price > 0 ? (annualRentFull / price) * 100 : 0;
    const noiYield = price > 0 ? (noi / price) * 100 : 0;
    const roi = totalCost > 0 ? (annualCF / totalCost) * 100 : 0;
    
    // Corrected ROE formula per user: =(B23-B17-B25)/(B12+B10)
    // B23: 想定年額家賃 (ei)
    // B17: 年間ローン返済額 (annualPay)
    // B25: 年額運営経費 (annualOpex)
    // B12: 頭金 (down)
    // B10: 購入時諸経費 (purchaseExpenses)
    const roeDenominator = down + purchaseExpenses;
    const roe = roeDenominator > 0 ? (annualCF / roeDenominator) * 100 : 0;
    
    const dsr = monthlyRentFull > 0 ? (monthlyPay / monthlyRentFull) * 100 : 0;
    const dscr = annualPay > 0 ? noi / annualPay : 0;
    const kPercent = price > 0 ? (loanAmt / price) * 100 : 0;
    const yieldGap = noiYield - rate;

    const updateColor = (el, val) => {
      if (!el) return;
      if (val < 0) {
        el.classList.add('red-highlight');
        el.classList.remove('blue-highlight');
      } else if (val > 0) {
        el.classList.add('blue-highlight');
        el.classList.remove('red-highlight');
      } else {
        el.classList.remove('red-highlight', 'blue-highlight');
      }
    };

    // Update Intermediate UI (Dashboard area)
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

    // Update Analysis Results UI
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
    revenueOutputs.outKPercent.textContent = (price > 0) ? kPercent.toFixed(2) + '%' : '-';
    revenueOutputs.outYieldGap.textContent = (price > 0) ? yieldGap.toFixed(2) + '%' : '-';
  };

  modeButtons.forEach((btn) => {
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

  const updateValuationOutputs = () => {
    const struct = valuationInputs.valStructure.value;
    let life = 0;
    let recPrice = 0;

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

  loanTabs.forEach((btn) => {
    btn.addEventListener('click', () => setLoanSubmode(btn.dataset.loanTab));
  });

  // Consolidated Listeners for Inputs
  [...Object.values(loanInputs), ...Object.values(revenueInputs)].forEach(input => {
    input?.addEventListener('input', () => {
      updateLoanOutputs();
      updateRevenueOutputs();
      saveState();
    });
  });

  [...Object.values(valuationInputs), ...Object.values(valuationSettings), valuationInputs.valStructure].forEach(input => {
    input?.addEventListener('input', () => {
      updateValuationOutputs();
      saveState();
    });
  });

  loadState(); // This handles its own defaults if nothing is loaded
  calc.addEventListener('mousemove', (e) => {
    const rect = calc.getBoundingClientRect();
    calc.style.setProperty('--cursor-x', `${e.clientX - rect.left}px`);
    calc.style.setProperty('--cursor-y', `${e.clientY - rect.top}px`);
    calc.style.setProperty('--cursor-active', '1');
  });

  calc.addEventListener('mouseleave', () => {
    calc.style.setProperty('--cursor-active', '0');
  });

  loanPanel.addEventListener('mousemove', (e) => {
    const rect = loanPanel.getBoundingClientRect();
    loanPanel.style.setProperty('--cursor-x', `${e.clientX - rect.left}px`);
    loanPanel.style.setProperty('--cursor-y', `${e.clientY - rect.top}px`);
    loanPanel.style.setProperty('--cursor-active', '1');
  });

  loanPanel.addEventListener('mouseleave', () => {
    loanPanel.style.setProperty('--cursor-active', '0');
  });

  const revPanel = document.querySelector('.revenue-panel');
  revPanel.addEventListener('mousemove', (e) => {
    const rect = revPanel.getBoundingClientRect();
    revPanel.style.setProperty('--cursor-x', `${e.clientX - rect.left}px`);
    revPanel.style.setProperty('--cursor-y', `${e.clientY - rect.top}px`);
    revPanel.style.setProperty('--cursor-active', '1');
  });

  revPanel.addEventListener('mouseleave', () => {
    revPanel.style.setProperty('--cursor-active', '0');
  });

  const valPanel = document.querySelector('.valuation-panel');
  valPanel.addEventListener('mousemove', (e) => {
    const rect = valPanel.getBoundingClientRect();
    valPanel.style.setProperty('--cursor-x', `${e.clientX - rect.left}px`);
    valPanel.style.setProperty('--cursor-y', `${e.clientY - rect.top}px`);
    valPanel.style.setProperty('--cursor-active', '1');
  });

  valPanel.addEventListener('mouseleave', () => {
    valPanel.style.setProperty('--cursor-active', '0');
  });

  render();
})();
