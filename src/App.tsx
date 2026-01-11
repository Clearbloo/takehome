import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// Types
interface Options {
  pensionEnabled: boolean;
  pensionType: 'percentage' | 'fixed';
  pensionValue: number;
  studentLoanPlan: 'none' | 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad';
}

interface Deduction {
  label: string;
  amount: number;
}

interface Calculation {
  grossAnnual: number;
  grossMonthly: number;
  deductions: Deduction[];
  totalDeductions: number;
  netAnnual: number;
  netMonthly: number;
}

interface GraphDataPoint {
  grossAnnual: number;
  netAnnual: number;
  netMonthly: number;
}

// Country module interface
const countries = {
  UK: {
    code: 'UK',
    name: 'United Kingdom',
    currency: '£',
    taxYear: '2024/25',
    
    // Personal allowance and thresholds
    personalAllowance: 12570,
    personalAllowanceTaperStart: 100000,
    personalAllowanceTaperRate: 0.5,
    
    // Income tax bands (England & Wales)
    incomeTaxBands: [
      { threshold: 12570, rate: 0, name: 'Personal Allowance' },
      { threshold: 50270, rate: 0.20, name: 'Basic Rate' },
      { threshold: 125140, rate: 0.40, name: 'Higher Rate' },
      { threshold: Infinity, rate: 0.45, name: 'Additional Rate' }
    ],
    
    // National Insurance
    niThresholds: [
      { threshold: 12570, rate: 0 },
      { threshold: 50270, rate: 0.08 },
      { threshold: Infinity, rate: 0.02 }
    ],
    
    // Student loan plans
    studentLoanPlans: {
      none: { threshold: 0, rate: 0, name: 'None' },
      plan1: { threshold: 24990, rate: 0.09, name: 'Plan 1' },
      plan2: { threshold: 27295, rate: 0.09, name: 'Plan 2' },
      plan4: { threshold: 31395, rate: 0.09, name: 'Plan 4' },
      plan5: { threshold: 25000, rate: 0.09, name: 'Plan 5' },
      postgrad: { threshold: 21000, rate: 0.06, name: 'Postgraduate' }
    }
  }
};

// Calculate UK salary breakdown
function calculateUKSalary(grossAnnual: number, options: Options): Calculation {
  const country = countries.UK;
  const deductions = [];
  
  // 1. Calculate pension (pre-tax deduction)
  let pensionAmount = 0;
  if (options.pensionEnabled) {
    if (options.pensionType === 'percentage') {
      pensionAmount = grossAnnual * (options.pensionValue / 100);
    } else {
      pensionAmount = options.pensionValue;
    }
  }
  
  const taxableIncome = grossAnnual - pensionAmount;
  
  // 2. Calculate personal allowance (tapered for high earners)
  let personalAllowance = country.personalAllowance;
  if (taxableIncome > country.personalAllowanceTaperStart) {
    const reduction = (taxableIncome - country.personalAllowanceTaperStart) * country.personalAllowanceTaperRate;
    personalAllowance = Math.max(0, personalAllowance - reduction);
  }
  
  // 3. Calculate income tax
  let incomeTax = 0;
  let remainingIncome = taxableIncome - personalAllowance;
  
  for (let i = 1; i < country.incomeTaxBands.length; i++) {
    const prevThreshold = country.incomeTaxBands[i - 1].threshold;
    const currThreshold = country.incomeTaxBands[i].threshold;
    const rate = country.incomeTaxBands[i].rate;
    
    if (remainingIncome > 0) {
      const bandWidth = currThreshold - prevThreshold;
      const taxableInBand = Math.min(remainingIncome, bandWidth);
      incomeTax += taxableInBand * rate;
      remainingIncome -= taxableInBand;
    }
  }
  
  // 4. Calculate National Insurance
  let nationalInsurance = 0;
  const remainingForNI = grossAnnual;
  
  for (let i = 1; i < country.niThresholds.length; i++) {
    const prevThreshold = country.niThresholds[i - 1].threshold;
    const currThreshold = country.niThresholds[i].threshold;
    const rate = country.niThresholds[i].rate;
    
    if (remainingForNI > prevThreshold) {
      const bandWidth = currThreshold - prevThreshold;
      const niInBand = Math.min(remainingForNI - prevThreshold, bandWidth);
      nationalInsurance += niInBand * rate;
    }
  }
  
  // 5. Calculate student loan repayment
  let studentLoan = 0;
  if (options.studentLoanPlan !== 'none') {
    const plan = country.studentLoanPlans[options.studentLoanPlan];
    if (grossAnnual > plan.threshold) {
      studentLoan = (grossAnnual - plan.threshold) * plan.rate;
    }
  }
  
  // Build deductions array
  if (pensionAmount > 0) {
    deductions.push({ label: 'Pension Contribution', amount: pensionAmount });
  }
  deductions.push({ label: 'Income Tax', amount: incomeTax });
  deductions.push({ label: 'National Insurance', amount: nationalInsurance });
  if (studentLoan > 0) {
    deductions.push({ label: 'Student Loan', amount: studentLoan });
  }
  
  const totalDeductions = pensionAmount + incomeTax + nationalInsurance + studentLoan;
  const netAnnual = grossAnnual - totalDeductions;
  
  return {
    grossAnnual,
    grossMonthly: grossAnnual / 12,
    deductions,
    totalDeductions,
    netAnnual,
    netMonthly: netAnnual / 12
  };
}

// Generate graph data
function generateGraphData(options: Options, minSalary = 15000, maxSalary = 150000, points = 100): GraphDataPoint[] {
  const data = [];
  const step = (maxSalary - minSalary) / points;
  
  for (let salary = minSalary; salary <= maxSalary; salary += step) {
    const calc = calculateUKSalary(salary, options);
    data.push({
      grossAnnual: Math.round(salary),
      netAnnual: Math.round(calc.netAnnual),
      netMonthly: Math.round(calc.netMonthly)
    });
  }
  
  return data;
}

// Custom dot component - defined outside render to avoid recreation
const CustomDot = (props: any) => {
  const { cx, cy, payload, salary } = props;
  if (payload && Math.abs(payload.grossAnnual - salary) < 1500) {
    return (
      <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
    );
  }
  return null;
};

function SalaryCalculator() {
  const [country] = useState('UK');
  const [options, setOptions] = useState<Options>({
    pensionEnabled: false,
    pensionType: 'percentage',
    pensionValue: 5,
    studentLoanPlan: 'none'
  });
  
  const [salary, setSalary] = useState(45000);
  const [graphGenerated, setGraphGenerated] = useState(false);
  
  // Generate graph data when options change
  const graphData = useMemo(() => {
    if (!graphGenerated) return [];
    return generateGraphData(options, 15000, 150000, 135);
  }, [options, graphGenerated]);
  
  // Calculate current salary breakdown
  const calculation = useMemo(() => {
    return calculateUKSalary(salary, options);
  }, [salary, options]);
  
  const handleGenerateGraph = () => {
    setGraphGenerated(true);
  };
  
  const handleSalaryChange = (value: string | number) => {
    const numValue = Number(value);
    if (!isNaN(numValue) && numValue >= 15000 && numValue <= 150000) {
      setSalary(numValue);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
            <h1 className="text-3xl font-bold mb-2">Salary Calculator</h1>
            <p className="text-blue-100">Calculate your take-home pay after tax and deductions</p>
          </div>
          
          {/* Country Selection */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Country
            </label>
            <select 
              value={country}
              className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="UK">United Kingdom (2024/25)</option>
            </select>
          </div>
          
          {/* Options Panel */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Deductions</h2>
            
            <div className="space-y-6">
              {/* Pension */}
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={options.pensionEnabled}
                    onChange={(e) => setOptions({...options, pensionEnabled: e.target.checked})}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-700">Pension Contribution</span>
                </label>
                
                {options.pensionEnabled && (
                  <div className="ml-8 space-y-3">
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pensionType"
                          value="percentage"
                          checked={options.pensionType === 'percentage'}
                          onChange={(e) => setOptions({...options, pensionType: e.target.value as 'percentage' | 'fixed'})}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Percentage</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pensionType"
                          value="fixed"
                          checked={options.pensionType === 'fixed'}
                          onChange={(e) => setOptions({...options, pensionType: e.target.value as 'percentage' | 'fixed'})}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Fixed Amount</span>
                      </label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={options.pensionValue}
                        onChange={(e) => setOptions({...options, pensionValue: Number(e.target.value)})}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step={options.pensionType === 'percentage' ? '0.5' : '100'}
                      />
                      <span className="text-gray-600">
                        {options.pensionType === 'percentage' ? '%' : '£ per year'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Student Loan */}
              <div className="space-y-3">
                <label className="block font-medium text-gray-700 mb-2">
                  Student Loan Repayment
                </label>
                <select
                  value={options.studentLoanPlan}
                  onChange={(e) => setOptions({...options, studentLoanPlan: e.target.value as Options['studentLoanPlan']})}
                  className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(countries.UK.studentLoanPlans).map(([key, plan]) => (
                    <option key={key} value={key}>{plan.name}</option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={handleGenerateGraph}
                className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
              >
                Generate Salary Graph
              </button>
            </div>
          </div>
          
          {/* Graph Section */}
          {graphGenerated && (
            <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-gray-50 to-white">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Salary vs Take-Home</h2>
              
              <div className="mb-6">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={graphData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="grossAnnual" 
                      tickFormatter={(value) => `£${(value/1000).toFixed(0)}k`}
                      stroke="#6b7280"
                    />
                    <YAxis 
                      tickFormatter={(value) => `£${(value/1000).toFixed(0)}k`}
                      stroke="#6b7280"
                    />
                    <Tooltip 
                      formatter={(value: number | undefined) => value ? `£${value.toLocaleString()}` : ''}
                      labelFormatter={(value) => `Gross: £${value.toLocaleString()}`}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <ReferenceLine 
                      stroke="#94a3b8" 
                      strokeDasharray="5 5"
                      segment={[{ x: 15000, y: 15000 }, { x: 150000, y: 150000 }]}
                      label={{ value: 'No Tax Line', position: 'insideTopRight', fill: '#64748b' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="netAnnual" 
                      stroke="#2563eb" 
                      strokeWidth={3}
                      dot={(props) => <CustomDot {...props} salary={salary} />}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Salary Input Controls */}
              <div className="space-y-4 bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-800 text-lg">Select Your Salary</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="text-gray-700 font-medium min-w-fit">Annual Salary:</label>
                    <div className="relative flex-1 max-w-xs">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                      <input
                        type="number"
                        value={salary}
                        onChange={(e) => handleSalaryChange(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="15000"
                        max="150000"
                        step="1000"
                      />
                    </div>
                  </div>
                  
                  <input
                    type="range"
                    value={salary}
                    onChange={(e) => handleSalaryChange(e.target.value)}
                    min="15000"
                    max="150000"
                    step="1000"
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>£15,000</span>
                    <span>£150,000</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Breakdown Section */}
          {graphGenerated && (
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Breakdown</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Monthly Take-Home */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                  <div className="text-sm text-green-700 mb-1">Monthly Take-Home</div>
                  <div className="text-4xl font-bold text-green-700">
                    £{calculation.netMonthly.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </div>
                </div>
                
                {/* Annual Summary */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-700 mb-1">Annual Take-Home</div>
                  <div className="text-4xl font-bold text-blue-700">
                    £{calculation.netAnnual.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </div>
                </div>
              </div>
              
              {/* Detailed Breakdown */}
              <div className="mt-6 bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-4">Detailed Breakdown (Annual)</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-300">
                    <span className="font-medium text-gray-700">Gross Salary</span>
                    <span className="font-semibold text-gray-900">
                      £{calculation.grossAnnual.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                  </div>
                  
                  {calculation.deductions.map((deduction, idx) => (
                    <div key={idx} className="flex justify-between items-center text-gray-700">
                      <span>{deduction.label}</span>
                      <span className="text-red-600">
                        -£{deduction.amount.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </span>
                    </div>
                  ))}
                  
                  <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300 font-semibold text-lg">
                    <span className="text-gray-800">Net Salary</span>
                    <span className="text-green-700">
                      £{calculation.netAnnual.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Effective Tax Rate</span>
                      <span className="font-medium">
                        {((calculation.totalDeductions / calculation.grossAnnual) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Disclaimer */}
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> This calculator provides estimates based on {countries.UK.taxYear} tax rules for England & Wales. 
                  Actual deductions may vary. This is not financial advice.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SalaryCalculator;
