// Shared payslip document model + HTML renderer, used by both the HR payroll-runs screen
// and the employee self-service payroll view. One source of truth for the printable layout.

export interface PayslipLine { label: string; amount: number; }
export interface PayslipDoc {
  company: { name: string; legal: string; address?: string | null };
  title: string;
  payPeriod: { from: string; to: string; label: string };
  employee: { id: string; personId: string; name: string; designation: string; department: string; band: string; doj?: string | null; gender?: string; location: string; pan: string; uan: string; pfNo: string; bankName: string; bankAccount: string; daysWorked: number; lwpCurrent: number };
  standardSalary: PayslipLine[]; totalStandard: number;
  earnings: PayslipLine[]; grossEarnings: number;
  deductions: PayslipLine[]; grossDeductions: number;
  netPay: number;
  tax: { taxableTillPrevMonth: number; currentMonthTaxable: number; projectedStandardSalary: number; grossSalary: number; standardDeduction: number; incomeUnderHeadSalary: number; grossTotalIncome: number; totalIncome: number; taxOnTotalIncome: number; healthEducationCess: number; taxPayable: number; taxDeductedSoFar: number; balanceTax: number };
  chapterVI: PayslipLine[];
  monthlyTax: { month: string; amount: number }[];
}

/** Renders the bordered, HCL-style payslip as a self-contained HTML string. */
export function buildPayslipHtml(d: PayslipDoc): string {
  const f = (n: number) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dt = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB').replace(/\//g, '.') : '—');
  const e = d.employee;
  const kv = (rows: [string, string][]) => `<table style="border:none">${rows.map(([k, v]) => `<tr class="nb"><td class="lbl">${k}</td><td class="cl">:</td><td>${v}</td></tr>`).join('')}</table>`;
  const left: [string, string][] = [
    ['Employee ID', e.id], ['Person ID', e.personId], ['Designation', e.designation], ['DOJ / Gender', `${dt(e.doj)} / ${e.gender || '—'}`],
    ['PAN No', e.pan], ['PF // Pension No', e.pfNo], ['UAN No', e.uan]
  ];
  const right: [string, string][] = [
    ['Bank Name & Account No', `${e.bankName} ${e.bankAccount}`], ['Location (CWL)', e.location], ['Department', e.department], ['Band', e.band],
    ['Days worked in month', f(e.daysWorked)], ['LWP Current/Previous Month', `${e.lwpCurrent.toFixed(2)}/0.00`], ['Sabbatical Leave Current/Previous Mon', '0.00/0.00']
  ];
  const maxLen = Math.max(d.standardSalary.length, d.earnings.length, d.deductions.length);
  const cell = (arr: PayslipLine[], i: number) => arr[i] ? `<td>${arr[i].label}</td><td class="r">${f(arr[i].amount)}</td>` : '<td></td><td></td>';
  let salaryRows = '';
  for (let i = 0; i < maxLen; i++) salaryRows += `<tr>${cell(d.standardSalary, i)}${cell(d.earnings, i)}${cell(d.deductions, i)}</tr>`;
  const t = d.tax;
  const projected: [string, string][] = [
    ['Taxable Income till Pr. Month', f(t.taxableTillPrevMonth)], ['Current Mth Taxable income', f(t.currentMonthTaxable)],
    ['Projected Standard Salary', f(t.projectedStandardSalary)], ['Gross Salary', f(t.grossSalary)], ['Standard Deduction', f(t.standardDeduction)],
    ['Income under Head Salary', f(t.incomeUnderHeadSalary)], ['Gross Total Income', f(t.grossTotalIncome)], ['Total Income', f(t.totalIncome)],
    ['Tax on Total Income', f(t.taxOnTotalIncome)], ['Health and Education cess', f(t.healthEducationCess)], ['Tax payable', f(t.taxPayable)],
    ['Tax deducted so far', f(t.taxDeductedSoFar)], ['Balance Tax', f(t.balanceTax)]
  ];
  const chapter = d.chapterVI.map((c) => `<tr class="nb"><td>${c.label}</td><td class="r">${f(c.amount)}</td></tr>`).join('')
    + `<tr class="nb b"><td>Total</td><td class="r">${f(d.chapterVI.reduce((a, c) => a + c.amount, 0))}</td></tr>`;
  const monthly = d.monthlyTax.map((m) => `<tr class="nb"><td>${m.month}</td><td class="r">${f(m.amount)}</td></tr>`).join('')
    + `<tr class="nb b"><td>Total</td><td class="r">${f(d.monthlyTax.reduce((a, m) => a + m.amount, 0))}</td></tr>`;

  return `<style>
    .payslip{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:11px;width:920px;margin:0 auto;border:1px solid #000;background:#fff}
    .payslip table{border-collapse:collapse;width:100%}
    .payslip td,.payslip th{border:1px solid #000;padding:2px 6px;vertical-align:top}
    .payslip .nb td,.payslip table.nb td{border:none;padding:1px 4px}
    .payslip .lbl{font-weight:bold;white-space:nowrap}.payslip .cl{width:8px}
    .payslip .r{text-align:right}.payslip .b{font-weight:bold}
    .payslip .sec{background:#e8e8e8;font-weight:bold}
    .payslip .center{text-align:center}
  </style>
  <div class="payslip">
    <table><tr>
      <td style="border:none" class="center">
        <div class="b" style="font-size:13px">${d.title}</div>
        <div>${d.payPeriod.label}</div>
        <div class="b" style="font-size:12px;margin-top:2px">${e.name}</div>
      </td>
      <td style="border:none;width:180px;text-align:right">
        <div class="b" style="color:#1e7fc2;font-size:16px">${d.company.name}</div>
        <div>${d.company.legal}</div>
        ${d.company.address ? `<div style="font-size:9px;color:#555">${d.company.address}</div>` : ''}
      </td>
    </tr></table>
    <table><tr>
      <td style="width:50%">${kv(left)}</td>
      <td style="width:50%">${kv(right)}</td>
    </tr></table>
    <table>
      <tr class="sec"><td>Standard Monthly Salary</td><td class="r">INR</td><td>Earnings</td><td class="r">INR</td><td>Deductions</td><td class="r">INR</td></tr>
      ${salaryRows}
      <tr class="b"><td>Total Standard Salary</td><td class="r">${f(d.totalStandard)}</td><td>Gross Earnings</td><td class="r">${f(d.grossEarnings)}</td><td>Gross Deductions</td><td class="r">${f(d.grossDeductions)}</td></tr>
      <tr class="b"><td style="border:none"></td><td style="border:none"></td><td style="border:none"></td><td style="border:none"></td><td class="sec">Net Pay</td><td class="r sec">${f(d.netPay)}</td></tr>
    </table>
    <table>
      <tr class="sec center"><td colspan="4">Income Tax Computation</td></tr>
      <tr class="sec center"><td>Exemption U/S 10</td><td>Projected / Actual Taxable Salary</td><td>Contribution under Chapter VI A</td><td>Monthly Tax Deduction</td></tr>
      <tr>
        <td style="width:22%"></td>
        <td style="width:34%">${kv(projected)}</td>
        <td style="width:22%"><table class="nb">${chapter}</table></td>
        <td style="width:22%"><table class="nb">${monthly}</table></td>
      </tr>
    </table>
    <div style="padding:6px;font-size:9px;line-height:1.4">
      *This is a computer generated payslip and doesn't require signature or any company seal.<br>
      *The current month pay slip has got generated after consideration of payroll input i.e. compensation letter, flexi declaration and approved inputs.<br>
      <div class="center b" style="margin-top:4px">Page 1 of 1</div>
    </div>
  </div>`;
}

/** Opens the payslip HTML in a new window and triggers the browser's print/save-as-PDF dialog. */
export function printPayslipHtml(rawHtml: string): boolean {
  const w = window.open('', '_blank', 'width=1024,height=820');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payslip</title></head><body style="margin:0" onload="setTimeout(function(){window.print()},150)">${rawHtml}</body></html>`);
  w.document.close();
  return true;
}
