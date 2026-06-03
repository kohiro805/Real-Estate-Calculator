(() => {
  const display = document.getElementById('display');
  const calc = document.querySelector('.calculator');
  const buttons = Array.from(document.querySelectorAll('.btn'));

  let current = '0';
  let justEvaluated = false;
  let previousExpression = '';
  let constantOperator = null;
  let constantValue = null;
  const modeState = { mode: 'basic' };

  const toNumber = (val) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  const roundTo = (value, dp = 2) => {
    const factor = 10 ** dp;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  };

  const calcAmortizationEqualPayment = (loanAmount, interestRate, loanTermYears) => {
    const P = toNumber(loanAmount);
    const r = toNumber(interestRate) / 12 / 100;
    const n = Math.max(1, Math.trunc(toNumber(loanTermYears) * 12));
    if (r === 0) {
      const pmt = roundTo(P / n, 2);
      return { monthlyPayment: pmt, totalPayment: roundTo(pmt * n, 2) };
    }
    const factor = (1 - Math.pow(1 + r, -n));
    const monthlyPayment = roundTo((P * r) / factor, 2);
    return { monthlyPayment };
  };

  const calcMonthlyPayment = (loanAmount, rate, years) => {
    const P = toNumber(loanAmount);
    const r = toNumber(rate) / 12 / 100;
    const n = Math.max(1, Math.trunc(toNumber(years) * 12));
    if (r === 0) return roundTo(P / n, 2);
    const factor = 1 - Math.pow(1 + r, -n);
    return roundTo((P * r) / factor, 2);
  };

  const calcLoanAmount = (monthlyPayment, rate, years) => {
    const pay = toNumber(monthlyPayment);
    const r = toNumber(rate) / 12 / 100;
    const n = Math.max(1, Math.trunc(toNumber(years) * 12));
    if (r === 0) return roundTo(pay * n, 2);
    const factor = 1 - Math.pow(1 + r, -n);
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

  const adjustFontSize = (element, maxFontSize, minFontSize) => {
    if (!element.textContent) return;
    element.style.whiteSpace = 'nowrap';
    let currentSize = maxFontSize;
    element.style.fontSize = currentSize + 'px';
    while (element.scrollWidth > element.clientWidth && currentSize > minFontSize) {
      currentSize -= 1;
      element.style.fontSize = currentSize + 'px';
    }
  };

  const render = () => {
    const expDiv = document.getElementById('expression');
    const resDiv = document.getElementById('result');
    if (!expDiv || !resDiv) return;

    if (justEvaluated) {
      expDiv.textContent = formatExpressionWithCommas(previousExpression);
      resDiv.textContent = formatDisplayValue(current, 21);
      
      // 動的にフォントサイズを調整（結果表示時）
      requestAnimationFrame(() => {
        adjustFontSize(resDiv, 64, 24); // 最大64px、最小24px
        adjustFontSize(expDiv, 24, 16);
      });
    } else {
      expDiv.textContent = formatExpressionWithCommas(current);
      resDiv.textContent = '';
      
      // 入力中の式表示サイズを調整
      requestAnimationFrame(() => {
        adjustFontSize(expDiv, 48, 20); // 入力中は大きく表示
      });
    }

    const kIndicator = document.getElementById('constant-indicator');
    if (kIndicator) kIndicator.classList.toggle('active', !!constantOperator);

    if (expDiv) expDiv.scrollLeft = expDiv.scrollWidth;
    if (resDiv) resDiv.scrollLeft = resDiv.scrollWidth;
  };

  const formatExpressionWithCommas = (expr) => {
    return expr.replace(/(\d+(\.\d*)?)/g, (match) => {
      const parts = match.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
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
          const parts = current.split(/[×÷+-]/);
          const operand = parts[parts.length - 2]; 
          if (operand) {
            constantOperator = normalizedValue;
            constantValue = operand.replace(/,/g, '');
          }
        } else {
          current = current.slice(0, -1) + normalizedValue;
        }
        saveState();
        return; 
      }
    }

    if (normalizedValue === '.') {
      const lastNumber = current.split(/[-+×÷]/).pop();
      if (lastNumber.includes('.')) return;
    }

    if (current.length >= 100) return;
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
        loanSubmode: document.body.dataset.loanSubmode,
        view: document.body.dataset.mode
      },
      loanAmount: {
        payment: { amt: loanInputs.loanAmount.value, rate: loanInputs.interestRate.value, term: loanInputs.loanTerm.value },
        borrow: { budget: loanInputs.monthlyBudget.value, rate: loanInputs.interestRate2.value, term: loanInputs.loanTerm2.value },
        period: { amt: loanInputs.periodLoanAmount.value, rate: loanInputs.periodInterestRate.value, monthly: loanInputs.periodMonthlyPayment.value }
      },
      revenueInputs: {
        propName: revenueInputs.propName ? revenueInputs.propName.value : '',
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
        valPropNameExport: document.getElementById('valPropNameExport') ? document.getElementById('valPropNameExport').value : '',
        valPropPrice: valuationInputs.valPropPrice.value,
        valRoadsideValue: valuationInputs.valRoadsideValue.value,
        valLandArea: valuationInputs.valLandArea.value,
        valStructure: valuationInputs.valStructure.value,
        valFloorArea: valuationInputs.valFloorArea.value,
        valBuildingAge: valuationInputs.valBuildingAge.value,
        settingsLifeWood: document.getElementById('settingsLifeWood') ? document.getElementById('settingsLifeWood').value : '',
        settingsPriceWood: document.getElementById('settingsPriceWood') ? document.getElementById('settingsPriceWood').value : '',
        settingsLifeSteel: document.getElementById('settingsLifeSteel') ? document.getElementById('settingsLifeSteel').value : '',
        settingsPriceSteel: document.getElementById('settingsPriceSteel') ? document.getElementById('settingsPriceSteel').value : '',
        settingsLifeRC: document.getElementById('settingsLifeRC') ? document.getElementById('settingsLifeRC').value : '',
        settingsPriceRC: document.getElementById('settingsPriceRC') ? document.getElementById('settingsPriceRC').value : '',
        revenueExpRate: document.getElementById('revenueSettingsExpRate') ? document.getElementById('revenueSettingsExpRate').value : '8'
      }
    };
    localStorage.setItem('calculatorState', JSON.stringify(state));
  };

  const loadState = () => {
    const saved = localStorage.getItem('calculatorState');
    if (!saved) {
      setMode('normal');
      return;
    }
    const state = JSON.parse(saved);
    if (state.calculator) {
      current = state.calculator.current || '0';
      previousExpression = state.calculator.previousExpression || '';
      justEvaluated = state.calculator.justEvaluated || false;
    }
    if (state.constants) {
      constantOperator = state.constants.operator || null;
      constantValue = state.constants.value || null;
    }
    if (state.loanAmount) {
      if (state.loanAmount.payment) {
        loanInputs.loanAmount.value = state.loanAmount.payment.amt || '';
        loanInputs.interestRate.value = state.loanAmount.payment.rate || '';
        loanInputs.loanTerm.value = state.loanAmount.payment.term || '';
      }
      if (state.loanAmount.borrow) {
        loanInputs.monthlyBudget.value = state.loanAmount.borrow.budget || '';
        loanInputs.interestRate2.value = state.loanAmount.borrow.rate || '';
        loanInputs.loanTerm2.value = state.loanAmount.borrow.term || '';
      }
      if (state.loanAmount.period) {
        loanInputs.periodLoanAmount.value = state.loanAmount.period.amt || '';
        loanInputs.periodInterestRate.value = state.loanAmount.period.rate || '';
        loanInputs.periodMonthlyPayment.value = state.loanAmount.period.monthly || '';
      }
    }
    if (state.revenueInputs) {
      Object.keys(state.revenueInputs).forEach(k => { if(revenueInputs[k]) revenueInputs[k].value = state.revenueInputs[k]; });
    }
    if (state.valuationInputs) {
      Object.keys(state.valuationInputs).forEach(k => { 
        if(valuationInputs[k]) valuationInputs[k].value = state.valuationInputs[k]; 
        else if (document.getElementById(k)) document.getElementById(k).value = state.valuationInputs[k];
      });
      if (state.valuationInputs.revenueExpRate && document.getElementById('revenueSettingsExpRate')) {
         document.getElementById('revenueSettingsExpRate').value = state.valuationInputs.revenueExpRate;
      }
    }
    if (state.modes) {
      if (state.modes.view) setMode(state.modes.view);
      if (state.modes.loanSubmode) setLoanSubmode(state.modes.loanSubmode);
    }
    updateAllOutputs();
    render();
  };

  const tokenize = (expr) => {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (ch === ' ') { i++; continue; }
      if ('()+*/'.includes(ch)) { tokens.push(ch); i++; continue; }
      if (ch === '-') {
        const isUnary = tokens.length === 0 || ('+-*/('.includes(tokens[tokens.length - 1]));
        if (isUnary) {
          let j = i + 1;
          while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
          tokens.push(expr.slice(i, j));
          i = j; continue;
        }
        tokens.push(ch); i++; continue;
      }
      if (/[0-9.]/.test(ch)) {
        let j = i;
        while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
        tokens.push(expr.slice(i, j));
        i = j; continue;
      }
      i++;
    }
    return tokens;
  };

  const formatDisplayValue = (value, threshold = 21) => {
    const num = Number(typeof value === 'string' ? value.replace(/,/g, '') : value);
    if (!Number.isFinite(num)) return 'Error';
    if (num === 0) return '0';
    return num.toLocaleString('ja-JP', { maximumFractionDigits: 10 });
  };

  const evaluate = () => {
    if (constantOperator && constantValue) {
      const k = Number(constantValue);
      let valToUse = Number(current.replace(/,/g, '').replace(/[×÷+-]$/, ''));
      let res;
      switch (constantOperator) {
        case '+': res = valToUse + k; break;
        case '-': res = valToUse - k; break;
        case '×': res = valToUse * k; break;
        case '÷': res = k === 0 ? NaN : valToUse / k; break;
      }
      previousExpression = `${valToUse} ${constantOperator}${constantOperator}`;
      current = formatDisplayValue(res, 21);
      justEvaluated = true;
      saveState();
      render();
      return;
    }

    try {
      let normalized = current.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '').replace(/[+\-*/]$/, '');
      if (!normalized) return;
      const result = eval(normalized); // Simple eval for now as it's safe local input
      previousExpression = normalized.replace(/\*/g, '×').replace(/\//g, '÷') + ' =';
      current = formatDisplayValue(result);
      justEvaluated = true;
    } catch {
      current = 'Error';
    }
    saveState();
    render();
  };

  // UI Glue
  const modeButtons = document.querySelectorAll('.mode-btn');
  const bodyEl = document.body;
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
    propName: document.getElementById('propName'),
    propPrice: document.getElementById('propPrice'),
    propDownPayment: document.getElementById('propDownPayment'),
    propInterest: document.getElementById('propInterest'),
    propTerm: document.getElementById('propTerm'),
    propAnnualRentFull: document.getElementById('propAnnualRentFull'),
    propOccupancy: document.getElementById('propOccupancy'),
    propExpRatio: document.getElementById('propExpRatio'),
    propExpectedYield: document.getElementById('propExpectedYield')
  };
  const valuationInputs = {
    valPropNameExport: document.getElementById('valPropNameExport'),
    valPropPrice: document.getElementById('valPropPrice'),
    valRoadsideValue: document.getElementById('valRoadsideValue'),
    valLandArea: document.getElementById('valLandArea'),
    valStructure: document.getElementById('valStructure'),
    valFloorArea: document.getElementById('valFloorArea'),
    valBuildingAge: document.getElementById('valBuildingAge')
  };

  const setMode = (mode) => {
    bodyEl.dataset.mode = mode;
    modeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    if (mode === 'revenue') updateRevenueOutputs(); // 収益モード時は計算を実行
    saveState();
  };

  const setLoanSubmode = (sub) => {
    bodyEl.dataset.loanSubmode = sub;
    document.querySelectorAll('.loan-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.loanTab === sub));
    saveState();
  };

  const updateColor = (elId, val) => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.classList.remove('blue-highlight', 'red-highlight');
    if (val < 0) el.classList.add('red-highlight');
    else if (val > 0) el.classList.add('blue-highlight');
  };

  const updateRevenueOutputs = () => {
    const price = toNumber(revenueInputs.propPrice.value);
    const down = toNumber(revenueInputs.propDownPayment.value);
    const rate = toNumber(revenueInputs.propInterest.value);
    const term = toNumber(revenueInputs.propTerm.value);
    const annualRentFull = toNumber(revenueInputs.propAnnualRentFull.value);
    const occ = toNumber(revenueInputs.propOccupancy.value) / 100;
    const expRatio = toNumber(revenueInputs.propExpRatio.value) / 100;

    // 1. 取得コストの計算
    const expRateStr = document.getElementById('revenueSettingsExpRate') ? document.getElementById('revenueSettingsExpRate').value : '8';
    const purchaseExpensesRate = toNumber(expRateStr) / 100;
    const purchaseExpenses = price * purchaseExpensesRate;
    const totalCost = price + purchaseExpenses;
    const loanAmt = Math.max(0, price - down);
    const monthlyPay = calcMonthlyPayment(loanAmt, rate, term);
    const annualPay = monthlyPay * 12;

    document.getElementById('outPropExpenses').textContent = purchaseExpenses ? Math.round(purchaseExpenses).toLocaleString() : '-';
    document.getElementById('outTotalCost').textContent = totalCost ? Math.round(totalCost).toLocaleString() : '-';
    document.getElementById('outPropLoanAmount').textContent = loanAmt ? Math.round(loanAmt).toLocaleString() : '-';
    document.getElementById('outPropMonthlyPay').textContent = monthlyPay ? Math.round(monthlyPay).toLocaleString() : '-';
    document.getElementById('outPropAnnualPay').textContent = annualPay ? Math.round(annualPay).toLocaleString() : '-';

    // 2. 運営収支の計算
    const monthlyRentFull = annualRentFull / 12;
    const monthlyRentEst = monthlyRentFull * occ;
    const annualRentEst = annualRentFull * occ;
    const annualOpex = annualRentFull * expRatio;
    const noi = annualRentEst - annualOpex;
    const expectedYield = parseFloat(document.getElementById('propExpectedYield').value) || 0;
    const salePrice = (expectedYield > 0 && annualRentFull > 0) ? (annualRentFull / (expectedYield / 100)) * 0.95 : 0;

    document.getElementById('outPropMonthlyRentEst').textContent = monthlyRentEst ? Math.round(monthlyRentEst).toLocaleString() : '-';
    document.getElementById('outPropAnnualRentEst').textContent = annualRentEst ? Math.round(annualRentEst).toLocaleString() : '-';
    document.getElementById('outAnnualOpex').textContent = annualOpex ? Math.round(annualOpex).toLocaleString() : '-';
    document.getElementById('outPropNOI').textContent = noi ? Math.round(noi).toLocaleString() : '-';
    document.getElementById('outPropSalePrice').textContent = salePrice ? Math.round(salePrice).toLocaleString() : '-';

    // 3. 収益指標の計算
    const annualCF = noi - annualPay;
    const monthlyCF = annualCF / 12;
    const saleProfit = salePrice > 0 ? salePrice - loanAmt : 0;

    document.getElementById('outCF').textContent = annualCF ? Math.round(annualCF).toLocaleString() : '-';
    document.getElementById('outMonthlyCF').textContent = monthlyCF ? Math.round(monthlyCF).toLocaleString() : '-';
    document.getElementById('outPropSaleProfit').textContent = saleProfit ? Math.round(saleProfit).toLocaleString() : '-';
    updateColor('outCF', annualCF);
    updateColor('outMonthlyCF', monthlyCF);
    updateColor('outPropSaleProfit', saleProfit);

    const grossYield = price > 0 ? (annualRentFull / price) * 100 : 0;
    const noiYield = price > 0 ? (noi / price) * 100 : 0;
    const yieldGap = noiYield - rate;
    const dscr = annualPay > 0 ? noi / annualPay : 0;
    const dsr = monthlyRentFull > 0 ? (monthlyPay / monthlyRentFull) * 100 : 0;
    const kPercent = price > 0 ? (loanAmt / price) * 100 : 0;
    const roe = (down + purchaseExpenses) > 0 ? (annualCF / (down + purchaseExpenses)) * 100 : 0;
    const roi = totalCost > 0 ? (annualCF / totalCost) * 100 : 0;

    document.getElementById('outGrossYield').textContent = price ? grossYield.toFixed(2) + '%' : '-';
    document.getElementById('outNOIYield').textContent = price ? noiYield.toFixed(2) + '%' : '-';
    document.getElementById('outYieldGap').textContent = price ? yieldGap.toFixed(2) + '%' : '-';
    document.getElementById('outDSCR').textContent = annualPay ? dscr.toFixed(2) : '-';
    document.getElementById('outDSR').textContent = monthlyRentFull ? dsr.toFixed(2) + '%' : '-';
    document.getElementById('outKPercent').textContent = price ? kPercent.toFixed(2) + '%' : '-';
    document.getElementById('outROE').textContent = (down + purchaseExpenses) ? roe.toFixed(2) + '%' : '-';
    document.getElementById('outROI').textContent = totalCost ? roi.toFixed(2) + '%' : '-';
  };

  const updateAllOutputs = () => {
    // 1. 返済額計算
    const repay = calcMonthlyPayment(loanInputs.loanAmount.value, loanInputs.interestRate.value, loanInputs.loanTerm.value);
    document.getElementById('outMonthlyPayment').textContent = repay > 0 ? Math.round(repay).toLocaleString() + ' 円' : '-';

    // 2. 借入可能額計算
    const borrow = calcLoanAmount(loanInputs.monthlyBudget.value, loanInputs.interestRate2.value, loanInputs.loanTerm2.value);
    document.getElementById('outLoanPossible').textContent = borrow > 0 ? Math.round(borrow).toLocaleString() + ' 円' : '-';

    // 3. 返済期間計算
    const period = calcLoanTerm(loanInputs.periodLoanAmount.value, loanInputs.periodInterestRate.value, loanInputs.periodMonthlyPayment.value);
    document.getElementById('outPeriodResult').textContent = (period > 0 && period !== Infinity) ? period.toFixed(1) + ' 年' : '-';

    // Revenue Calculation (Shared logic)
    updateRevenueOutputs();

    // Valuation (Accurate logic)
    const struct = valuationInputs.valStructure.value;
    let life = 22; let recPrice = 150000;
    
    if (struct === 'rc') {
      life = toNumber(document.getElementById('settingsLifeRC').value || 47);
      recPrice = toNumber(document.getElementById('settingsPriceRC').value || 242000);
    } else if (struct === 'steel') {
      life = toNumber(document.getElementById('settingsLifeSteel').value || 34);
      recPrice = toNumber(document.getElementById('settingsPriceSteel').value || 180000);
    } else {
      life = toNumber(document.getElementById('settingsLifeWood').value || 22);
      recPrice = toNumber(document.getElementById('settingsPriceWood').value || 150000);
    }
    
    const roadside = toNumber(valuationInputs.valRoadsideValue.value);
    const landArea = toNumber(valuationInputs.valLandArea.value);
    const landCorr = toNumber(document.getElementById('valLandCorrection').value || 100) / 100;
    const landVal = roadside * landArea * landCorr;

    const floorArea = toNumber(valuationInputs.valFloorArea.value);
    const age = toNumber(valuationInputs.valBuildingAge.value);
    const buildingVal = floorArea * recPrice * (Math.max(0, life - age) / life);
    
    const totalVal = landVal + buildingVal;
    const propPrice = toNumber(valuationInputs.valPropPrice.value);
    const ratio = propPrice > 0 ? (totalVal / propPrice) * 100 : 0;
    
    document.getElementById('outValTotal').textContent = totalVal ? Math.round(totalVal).toLocaleString() : '-';
    document.getElementById('outValLand').textContent = landVal ? Math.round(landVal).toLocaleString() : '-';
    document.getElementById('outValBuilding').textContent = buildingVal ? Math.round(buildingVal).toLocaleString() : '-';
    document.getElementById('outValRatio').textContent = propPrice ? ratio.toFixed(2) + '%' : '-';
  };

  // Event Listeners
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      const action = btn.dataset.action;
      if (action === 'clear') clearAll();
      else if (action === 'delete') backspace();
      else if (action === 'equals') evaluate();
      else if (val) append(val);
      render();
    });
  });

  modeButtons.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  document.querySelectorAll('.loan-tab').forEach(btn => btn.addEventListener('click', () => setLoanSubmode(btn.dataset.loanTab)));
  const toggleSettingsBtn = document.getElementById('toggleValuationSettingsBtn');
  if (toggleSettingsBtn) {
    toggleSettingsBtn.addEventListener('click', () => {
      const section = document.getElementById('valuationSettingsSection');
      const textSpan = document.getElementById('valuationSettingsBtnText');
      if (section.style.display === 'none') {
        section.style.display = 'flex';
        if (textSpan) textSpan.textContent = '閉じる';
      } else {
        section.style.display = 'none';
        if (textSpan) textSpan.textContent = '設定';
      }
    });
  }

  const toggleRevenueSettingsBtn = document.getElementById('toggleRevenueSettingsBtn');
  if (toggleRevenueSettingsBtn) {
    toggleRevenueSettingsBtn.addEventListener('click', () => {
      const section = document.getElementById('revenueSettingsSection');
      const textSpan = document.getElementById('revenueSettingsBtnText');
      if (section.style.display === 'none') {
        section.style.display = 'flex';
        if (textSpan) textSpan.textContent = '閉じる';
      } else {
        section.style.display = 'none';
        if (textSpan) textSpan.textContent = '設定';
      }
    });
  }

  document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', () => {
    updateAllOutputs();
    saveState();
  }));

  const exportRevenueBtn = document.getElementById('exportRevenueBtn');
  if (exportRevenueBtn) {
    exportRevenueBtn.addEventListener('click', () => {
      const name = revenueInputs.propName ? revenueInputs.propName.value : '';
      
      const text = `【収益シミュレーション結果】
物件名: ${name || '未入力'}

■ 取得条件
取得価格: ${Number(revenueInputs.propPrice.value).toLocaleString() || 0}円
自己資金: ${Number(revenueInputs.propDownPayment.value).toLocaleString() || 0}円
借入金額: ${document.getElementById('outPropLoanAmount').textContent}円
借入金利: ${revenueInputs.propInterest.value || 0}%
借入期間: ${revenueInputs.propTerm.value || 0}年

■ 運営条件
満室年次賃料: ${Number(revenueInputs.propAnnualRentFull.value).toLocaleString() || 0}円
想定稼働率: ${revenueInputs.propOccupancy.value || 0}%
運営費率: ${revenueInputs.propExpRatio.value || 0}%
売却利回り: ${revenueInputs.propExpectedYield.value || 0}%

■ 収益指標
年次キャッシュフロー: ${document.getElementById('outCF').textContent}円
月次キャッシュフロー: ${document.getElementById('outMonthlyCF').textContent}円
想定売却益: ${document.getElementById('outPropSaleProfit').textContent}円
表面利回り: ${document.getElementById('outGrossYield').textContent}
実質利回り: ${document.getElementById('outNOIYield').textContent}
イールドギャップ: ${document.getElementById('outYieldGap').textContent}
債務回収比率(DSCR): ${document.getElementById('outDSCR').textContent}
返済比率: ${document.getElementById('outDSR').textContent}
借入金比率: ${document.getElementById('outKPercent').textContent}
自己資本利益率(ROE): ${document.getElementById('outROE').textContent}
投資利益率(ROI): ${document.getElementById('outROI').textContent}
`;
      
      try {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filenameLabel = name ? `${name}_` : '';
        a.download = `${filenameLabel}収益シミュレーション結果.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (err) {
        alert('ファイルの保存に失敗しました。\n\n結果:\n' + text);
      }
    });
  }

  const exportValuationBtn = document.getElementById('exportValuationBtn');
  if (exportValuationBtn) {
    exportValuationBtn.addEventListener('click', () => {
      const name = valuationInputs.valPropNameExport ? valuationInputs.valPropNameExport.value : '';
      const structText = valuationInputs.valStructure.options ? valuationInputs.valStructure.options[valuationInputs.valStructure.selectedIndex].text : valuationInputs.valStructure.value;
      const landCorrEl = document.getElementById('valLandCorrection');
      const landCorr = landCorrEl && landCorrEl.value ? landCorrEl.value : '100';
      
      const text = `【積算シミュレーション結果】
物件名: ${name || '未入力'}

■ 物件概況
物件価格: ${Number(valuationInputs.valPropPrice.value).toLocaleString() || 0}円

■ 土地情報
相続税路線価: ${Number(valuationInputs.valRoadsideValue.value).toLocaleString() || 0}円
土地面積: ${valuationInputs.valLandArea.value || 0}㎡
地形補正率: ${landCorr}%

■ 建物情報
建物構造: ${structText}
延べ床面積: ${valuationInputs.valFloorArea.value || 0}㎡
築年数: ${valuationInputs.valBuildingAge.value || 0}年

■ 評価結果
土地評価額: ${document.getElementById('outValLand').textContent}円
建物評価額: ${document.getElementById('outValBuilding').textContent}円
合計評価額: ${document.getElementById('outValTotal').textContent}円
積算比率: ${document.getElementById('outValRatio').textContent}
`;
      
      try {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filenameLabel = name ? `${name}_` : '';
        a.download = `${filenameLabel}積算シミュレーション結果.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (err) {
        alert('ファイルの保存に失敗しました。\n\n結果:\n' + text);
      }
    });
  }

  loadState();
})();
