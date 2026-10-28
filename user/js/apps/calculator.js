
import { registerApp } from '../navigation.js';

export function renderCalculator() {
  const root = document.querySelector('#app-calculator');
  if (!root) return;

  if (root.querySelector('.calculator-app')) return;

  root.innerHTML = `
    <div class="calculator-app">
      <div class="calculator-display">
        <div class="calculator-expression"></div>
        <div class="calculator-result">0</div>
      </div>
      <div class="calculator-buttons">
        ${[
          'AC', '+/-', '%', '÷',
          '7', '8', '9', '×',
          '4', '5', '6', '−',
          '1', '2', '3', '+',
          '0', '.', '='
        ].map(key => `
          <button type="button"
            class="calculator-button ${
              ['÷', '×', '−', '+', '='].includes(key) ? 'operator' : ''
            } ${
              ['AC', '+/-', '%'].includes(key) ? 'utility' : ''
            } ${key === '0' ? 'zero' : ''}"
            data-key="${key}">${key}</button>
        `).join('')}
      </div>
    </div>
  `;

  const expressionEl = root.querySelector('.calculator-expression');
  const resultEl = root.querySelector('.calculator-result');
  const buttons = root.querySelector('.calculator-buttons');

  let expression = '';
  let result = '0';

  function update() {
    expressionEl.textContent = expression;
    resultEl.textContent = result;
  }

  function calculate() {
    const normalized = expression
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/\s/g, '');

    if (!normalized || !/^[\d.+\-*/()%]+$/.test(normalized)) {
      result = 'Error';
      return;
    }

    try {
      const value = Function(
        `"use strict"; return (${normalized})`
      )();

      if (!Number.isFinite(value)) {
        result = 'Error';
        return;
      }

      result = String(Number(value.toFixed(8)));
      expression = result;
    } catch {
      result = 'Error';
    }
  }

  buttons.addEventListener('click', event => {
    const button = event.target.closest('[data-key]');
    if (!button) return;

    const key = button.dataset.key;

    if (key === 'AC') {
      expression = '';
      result = '0';
    } else if (key === '=') {
      calculate();
    } else if (key === '+/-') {
      if (expression) {
        expression = expression.startsWith('-')
          ? expression.slice(1)
          : '-' + expression;
        result = expression;
      }
    } else if (key === '%') {
      if (expression) {
        expression += '/100';
        result = expression;
      }
    } else {
      if (result === 'Error') {
        expression = '';
        result = '0';
      }
      expression += key;
      result = expression;
    }

    update();
  });
}

export function initCalculator() {
  const root = document.querySelector('#app-calculator');
  if (!root) {
    console.error('Elemen #app-calculator tidak ditemukan.');
    return;
  }

  registerApp('calculator', {
    root,
    render: renderCalculator
  });

  renderCalculator();
}
