import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- Configuration ---
const LARGE_NUMBERS = [25, 50, 75, 100];
const SMALL_NUMBERS = Array(2).fill(null).flatMap(() => Array.from({ length: 10 }, (_, i) => i + 1));
// const INPUT_TIMEOUT_SECONDS = 60; // Default timeout no longer needed here

// --- Timer Options ---
const timerOptions = [
    { label: '15 seconds', value: 15 },
    { label: '30 seconds', value: 30 },
    { label: '1 minute', value: 60 },
    { label: '2 minutes', value: 120 },
    { label: '5 minutes', value: 300 },
    { label: 'No Timer', value: null }, // Use null for no timer
];

// --- Helper Functions (JS versions) ---
// (selectNumbers, generateTarget, solver logic, formula evaluator - these remain unchanged)

// Generates combinations of elements from an array
function getCombinations(array, k) {
    const result = [];
    function combine(startIndex, currentCombination) {
        if (currentCombination.length === k) {
            result.push([...currentCombination]);
            return;
        }
        if (startIndex >= array.length) {
            return;
        }
        currentCombination.push(array[startIndex]);
        combine(startIndex + 1, currentCombination);
        currentCombination.pop();
        combine(startIndex + 1, currentCombination);
    }
    combine(0, []);
    return result;
}

// Selects numbers for the game
function selectNumbers(numLarge) {
    if (numLarge < 0 || numLarge > 4) {
        throw new Error("Number of large numbers must be between 0 and 4.");
    }
    const numSmall = 6 - numLarge;
    const selectedLarge = [];
    const largeCopy = [...LARGE_NUMBERS];
    for (let i = 0; i < numLarge; i++) {
        const randIndex = Math.floor(Math.random() * largeCopy.length);
        selectedLarge.push(largeCopy.splice(randIndex, 1)[0]);
    }
    const selectedSmall = [];
    const smallCopy = [...SMALL_NUMBERS];
    for (let i = 0; i < numSmall; i++) {
        const randIndex = Math.floor(Math.random() * smallCopy.length);
        selectedSmall.push(smallCopy.splice(randIndex, 1)[0]);
    }
    const selected = [...selectedLarge, ...selectedSmall];
    // Shuffle the selected numbers
    for (let i = selected.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selected[i], selected[j]] = [selected[j], selected[i]];
    }
    return selected;
}

// Generates the target number
function generateTarget() {
    return Math.floor(Math.random() * (999 - 101 + 1)) + 101;
}

// --- Solver Logic (Computer's Solution - JS version) ---
const solverOps = {
    '+': (a, b) => a + b,
    '-': (a, b) => a - b,
    '*': (a, b) => a * b,
    '/': (a, b) => (b !== 0 && a % b === 0) ? a / b : null,
};
let solveCache = {}; // Using a module-level variable for cache

function solveNumbersGameInternal(numbers) {
    const numbersTuple = numbers.slice().sort((a, b) => a - b).join(',');
    if (solveCache[numbersTuple]) {
        return solveCache[numbersTuple];
    }

    if (numbers.length === 1) {
        const result = { [numbers[0]]: String(numbers[0]) };
        solveCache[numbersTuple] = result;
        return result;
    }

    const results = {};
    numbers.forEach(n => {
        results[n] = String(n);
    });

    for (let i = 1; i <= Math.floor(numbers.length / 2); i++) {
        const indices = Array.from({ length: numbers.length }, (_, k) => k);
        const leftIndicesCombinations = getCombinations(indices, i);

        for (const leftIndices of leftIndicesCombinations) {
            const leftNums = leftIndices.map(idx => numbers[idx]);
            const rightNums = numbers.filter((_, idx) => !leftIndices.includes(idx));

            const resLeft = solveNumbersGameInternal(leftNums);
            const resRight = solveNumbersGameInternal(rightNums);

            for (const valL in resLeft) {
                for (const valR in resRight) {
                    const numL = parseInt(valL);
                    const numR = parseInt(valR);
                    const exprL = resLeft[valL];
                    const exprR = resRight[valR];

                    for (const opSym in solverOps) {
                        let res = solverOps[opSym](numL, numR);
                        // Allow 0 as an intermediate result, but not negative
                        if (res !== null && res >= 0 && Number.isInteger(res)) {
                            const expr = `(${exprL} ${opSym} ${exprR})`;
                             // Only store positive final results, but allow 0 intermediate
                            if (res > 0 && !results[res]) results[res] = expr;
                        }
                        // For non-commutative operations (-, /)
                        if (opSym === '-' || opSym === '/') {
                            res = solverOps[opSym](numR, numL);
                            if (res !== null && res >= 0 && Number.isInteger(res)) {
                                const expr = `(${exprR} ${opSym} ${exprL})`;
                                if (res > 0 && !results[res]) results[res] = expr;
                            }
                        }
                    }
                }
            }
        }
    }
    solveCache[numbersTuple] = results;
    return results;
}

function solveNumbersGame(numbers) {
    solveCache = {}; // Clear cache for a new set of numbers
    return solveNumbersGameInternal(numbers);
}


function getSolutionMessage(allReachable, target) {
    if (allReachable[target]) {
        return `Optimal solution: ${target} = ${allReachable[target]}`;
    } else {
        if (Object.keys(allReachable).length === 0) return "No solution possible with these numbers.";
        let closestVal = -1;
        let minDiff = Infinity;
        for (const valStr in allReachable) {
            const val = parseInt(valStr);
            const diff = Math.abs(val - target);
            if (diff < minDiff) {
                minDiff = diff;
                closestVal = val;
            } else if (diff === minDiff) {
                if (Math.abs(val - target) < Math.abs(closestVal - target)) {
                     closestVal = val;
                }
            }
        }
         if (closestVal === -1) { // Handle case where only non-positive numbers were reachable
            return "No positive solution found by computer.";
        }
        return `Exact target not found by computer. Closest possible: ${closestVal} = ${allReachable[closestVal]} (Difference: ${minDiff})`;
    }
}


// --- User Formula Validation and Evaluation (JS version) ---
class FormulaError extends Error {
    constructor(message) {
        super(message);
        this.name = "FormulaError";
    }
}

function tokenize(formula) {
    const regex = /\d+|[+\-*/()]|\S/g;
    let tokens = formula.match(regex) || [];
    tokens = tokens.filter(token => /\d+|[+\-*/()]/.test(token));
    return tokens;
}

function toPostfix(tokens) {
    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
    const outputQueue = [];
    const operatorStack = [];

    for (const token of tokens) {
        if (!isNaN(parseInt(token))) { // Number
            outputQueue.push(token);
        } else if (token in precedence) { // Operator
            while (
                operatorStack.length > 0 &&
                operatorStack[operatorStack.length - 1] !== '(' &&
                precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]
            ) {
                outputQueue.push(operatorStack.pop());
            }
            operatorStack.push(token);
        } else if (token === '(') {
            operatorStack.push(token);
        } else if (token === ')') {
            while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
                outputQueue.push(operatorStack.pop());
            }
            if (operatorStack.length === 0 || operatorStack[operatorStack.length - 1] !== '(') {
                throw new FormulaError("Mismatched parentheses in formula.");
            }
            operatorStack.pop(); // Pop '('
        } else {
            throw new FormulaError(`Invalid token in formula: ${token}`);
        }
    }

    while (operatorStack.length > 0) {
        if (operatorStack[operatorStack.length - 1] === '(') {
            throw new FormulaError("Mismatched parentheses in formula.");
        }
        outputQueue.push(operatorStack.pop());
    }
    return outputQueue;
}

function evaluatePostfix(postfixTokens, availableNumbers) {
    const valueStack = [];
    const usedNumbers = {};
    const availableNumbersCount = {};
    availableNumbers.forEach(num => {
        availableNumbersCount[num] = (availableNumbersCount[num] || 0) + 1;
    });

    for (const token of postfixTokens) {
        if (!isNaN(parseInt(token))) { // Number
            const num = parseInt(token);
            if (!availableNumbersCount[num] || usedNumbers[num] >= availableNumbersCount[num]) {
                 if (!(num in availableNumbersCount)) throw new FormulaError(`Number not allowed: ${num}`);
                 else throw new FormulaError(`Number used too many times: ${num}`);
            }
            usedNumbers[num] = (usedNumbers[num] || 0) + 1;
            valueStack.push(num);
        } else { // Operator
            if (valueStack.length < 2) throw new FormulaError("Invalid formula structure (not enough operands).");
            const b = valueStack.pop();
            const a = valueStack.pop();
            let result;
            switch (token) {
                case '+': result = a + b; break;
                case '-': result = a - b; break;
                case '*': result = a * b; break;
                case '/':
                    if (b === 0) throw new FormulaError("Division by zero.");
                    if (a % b !== 0) throw new FormulaError(`Non-integer division: ${a} / ${b}. Result must be a whole number.`);
                    result = a / b;
                    break;
                default: throw new FormulaError(`Unknown operator: ${token}`);
            }
            // Allow zero results, but not negative
            if (result < 0) throw new FormulaError("Intermediate calculations cannot result in negative numbers.");
            valueStack.push(result);
        }
    }

    if (valueStack.length !== 1) throw new FormulaError("Invalid formula structure (too many operands or operators).");
    return valueStack[0];
}

function evaluateUserFormula(formulaStr, availableNumbers) {
    if (!formulaStr.trim()) {
        throw new FormulaError("Formula cannot be empty.");
    }
    try {
        const tokens = tokenize(formulaStr);
        tokens.forEach(token => {
            if (isNaN(parseInt(token)) && !['+', '-', '*', '/', '(', ')'].includes(token)) {
                throw new FormulaError(`Invalid character or sequence in formula: ${token}`);
            }
        });
        const postfix = toPostfix(tokens);
        return evaluatePostfix(postfix, availableNumbers);
    } catch (e) {
        if (e instanceof FormulaError) throw e;
        console.error("Formula evaluation error:", e);
        throw new FormulaError(`Error parsing or evaluating formula.`);
    }
}


// --- React Component (Using Bootstrap Dark Theme) ---
function App() {
    const [gameState, setGameState] = useState('setup'); // 'setup', 'playing', 'results'
    const [numLarge, setNumLarge] = useState(null); // Track selected large count
    const [selectedTimeout, setSelectedTimeout] = useState(60); // Track selected timeout (default 60s)
    const [selectedNumbers, setSelectedNumbers] = useState([]);
    const [target, setTarget] = useState(null);
    const [userFormula, setUserFormula] = useState('');
    const [timeLeft, setTimeLeft] = useState(selectedTimeout); // Initialize timeLeft based on default selectedTimeout
    const [userResult, setUserResult] = useState(null);
    const [computerSolution, setComputerSolution] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [score, setScore] = useState({ user: 0, rounds: 0 });

    const timerIntervalRef = useRef(null);

    // Timer Effect
    useEffect(() => {
        // Only run the timer if a timeout is selected (not null) and game is playing
        if (gameState === 'playing' && selectedTimeout !== null && timeLeft > 0) {
            timerIntervalRef.current = setInterval(() => {
                setTimeLeft(prevTime => prevTime - 1);
            }, 1000);
        } else if (timeLeft === 0 && gameState === 'playing' && selectedTimeout !== null) {
            // Time's up only if there was a timer running
            clearInterval(timerIntervalRef.current);
            setInfoMessage("Time's up!");
            handleShowResults(true); // Pass true for timeout
        }
        // Cleanup interval on component unmount or when dependencies change
        return () => clearInterval(timerIntervalRef.current);
    }, [gameState, timeLeft, selectedTimeout]); // Add selectedTimeout to dependencies

    // Effect to clear interval when game state changes away from 'playing'
    useEffect(() => {
        if (gameState !== 'playing') {
            clearInterval(timerIntervalRef.current);
        }
    }, [gameState]);


    // startGame Function - accepts largeCount and timeoutDuration
    const startGame = useCallback((largeCount, timeoutDuration) => {
        setErrorMessage(''); // Clear errors from setup
        try {
            // numLarge is already set by button click, no need to set it here
            const numbers = selectNumbers(largeCount);
            setSelectedNumbers(numbers);
            const newTarget = generateTarget();
            setTarget(newTarget);

            setGameState('playing');
            setUserFormula('');
            setUserResult(null);
            setComputerSolution('');
            setInfoMessage('');
            // Set initial timeLeft based on selection (handle null for No Timer)
            setTimeLeft(timeoutDuration === null ? Infinity : timeoutDuration);

            // --- Computer Solution Calculation ---
            setInfoMessage("Computer is thinking...");
            setTimeout(() => {
                try {
                    const solutions = solveNumbersGame([...numbers]);
                    const solutionMsg = getSolutionMessage(solutions, newTarget);
                    setComputerSolution(solutionMsg);
                    // Check gameState again in case user submitted very fast
                    // Use a functional update for infoMessage if depending on previous state is needed
                    setInfoMessage(prev => gameState === 'playing' ? '' : prev);
                } catch (e) {
                    console.error("Solver error:", e);
                    setComputerSolution("Error calculating computer's solution.");
                    setInfoMessage(prev => gameState === 'playing' ? '' : prev);
                }
            }, 50);

        } catch (e) {
            setErrorMessage(e.message);
            setGameState('setup'); // Go back to setup on error
        }
    // Removed numLarge from dependencies as it's set before calling startGame
    }, [gameState]); // Keep gameState dependency

    // handleFormulaSubmit Function (remains largely the same)
    const handleFormulaSubmit = () => {
        if (!userFormula.trim()) {
            setErrorMessage("Please enter a formula.");
            return;
        }
        clearInterval(timerIntervalRef.current); // Stop timer on submit
        try {
            const result = evaluateUserFormula(userFormula, selectedNumbers);
            setUserResult(result);
            setErrorMessage('');
            let points = 0;
            const diff = Math.abs(result - target);
            if (diff === 0) points = 10;
            else if (diff <= 5) points = 7;
            else if (diff <= 10) points = 5;
            setScore(prev => ({ user: prev.user + points, rounds: prev.rounds + 1 }));
            setInfoMessage(`Your formula evaluates to: ${result}. You scored ${points} points.`);
            handleShowResults(false);
        } catch (e) {
            if (e instanceof FormulaError) {
                setErrorMessage(`Formula Error: ${e.message}`);
            } else {
                console.error("Unexpected evaluation error:", e);
                setErrorMessage(`An unexpected error occurred evaluating the formula.`);
            }
            setUserResult(null);
        }
    };

    // handleShowResults Function (remains largely the same)
    const handleShowResults = (timeout = false) => {
        setGameState('results');
        clearInterval(timerIntervalRef.current);
        if (timeout && userResult === null) {
             setScore(prev => ({ ...prev, rounds: prev.rounds + 1 }));
        }
    };

    // handlePlayAgain Function (reset new state vars)
    const handlePlayAgain = () => {
        setGameState('setup');
        setNumLarge(null); // Reset large number selection
        // Keep selectedTimeout as is, or reset to default? Let's keep it.
        // setSelectedTimeout(60); // Uncomment to reset timer choice
        setSelectedNumbers([]);
        setTarget(null);
        setUserFormula('');
        setUserResult(null);
        setComputerSolution('');
        setErrorMessage('');
        setInfoMessage('');
        // timeLeft will be set correctly when startGame is called next
    };

    // --- UI Rendering with Bootstrap Dark Theme Classes ---

    // Updated renderSetup Function
    const renderSetup = () => (
        <div className="container mt-5" style={{ maxWidth: '600px' }}>
            <div className="card shadow-lg border-secondary">
                <div className="card-body p-md-5 p-4 bg-body-tertiary rounded text-light">
                    <h1 className="card-title text-center mb-4 h2 text-info">Numbers Game Setup</h1>

                    {/* Large Number Selection */}
                    <fieldset className="mb-4">
                        <legend className="text-center mb-3 lead fs-5">1. Select Large Numbers (0-4):</legend>
                        <div className="d-flex flex-wrap justify-content-center gap-2">
                            {[0, 1, 2, 3, 4].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setNumLarge(n)} // Set numLarge state on click
                                    className={`btn btn-lg px-4 fw-bold ${numLarge === n ? 'btn-info' : 'btn-outline-info'}`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    {/* Timer Selection */}
                    <fieldset className="mb-4">
                         <legend className="text-center mb-3 lead fs-5">2. Select Timer:</legend>
                         <div className="d-flex flex-wrap justify-content-center gap-3">
                            {timerOptions.map(option => (
                                <div className="form-check" key={option.label}>
                                    <input
                                        className="form-check-input"
                                        type="radio"
                                        name="timerOptions"
                                        id={`timer-${option.label.replace(/\s+/g, '-')}`} // Ensure valid ID
                                        // Use 'null_string' or similar if value needs to be string, parse later
                                        value={option.value === null ? 'null_string' : option.value}
                                        checked={selectedTimeout === option.value}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSelectedTimeout(val === 'null_string' ? null : parseInt(val));
                                        }}
                                    />
                                    <label className="form-check-label text-dark" htmlFor={`timer-${option.label.replace(/\s+/g, '-')}`}>
                                        {option.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </fieldset>

                    {/* Start Game Button */}
                    <div className="d-grid mt-4">
                        <button
                            onClick={() => {
                                if (numLarge !== null) {
                                     // Pass selected numLarge and selectedTimeout
                                    startGame(numLarge, selectedTimeout);
                                } else {
                                    setErrorMessage("Please select the number of large numbers.");
                                }
                            }}
                            disabled={numLarge === null} // Only need numLarge selected to enable
                            className="btn btn-success btn-lg fw-bold"
                        >
                            Start Game
                        </button>
                    </div>

                    {/* Error Message Display */}
                    {errorMessage && <p className="mt-4 text-danger text-center">{errorMessage}</p>}
                </div>
            </div>
        </div>
    );

    // Updated renderPlaying Function
    const renderPlaying = () => (
        <div className="container mt-4" style={{ maxWidth: '700px' }}>
            <div className="card shadow border-secondary">
                <div className="card-body p-md-4 p-3 bg-dark rounded">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h2 className="h4 mb-0 text-info">Round {score.rounds + 1}</h2>
                        {/* Conditionally render timer badge only if a timer is selected */}
                        {selectedTimeout !== null && (
                            <div className="badge bg-warning text-dark fs-5 p-2 rounded-pill">
                                {/* Display time left, handle Infinity if somehow set (shouldn't be if selectedTimeout is not null) */}
                                Time Left: {timeLeft === Infinity ? 'N/A' : `${timeLeft}s`}
                            </div>
                        )}
                    </div>

                    {/* Card for numbers */}
                    <div className="card bg-body-tertiary border-secondary p-3 mb-4 rounded">
                        <h3 className="h6 mb-2 text-white-50">Your numbers are:</h3>
                        <div className="d-flex flex-wrap gap-2 justify-content-center">
                            {selectedNumbers.map((num, index) => (
                                <span key={index} className="badge bg-primary fs-4 p-2 rounded-pill shadow-sm">
                                    {num}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Card for target */}
                    <div className="card bg-black border-success p-3 mb-4 text-center rounded">
                        <h3 className="h6 mb-0 text-white-50">
                            Target: <span className="display-4 fw-bold text-success">{target}</span>
                        </h3>
                    </div>

                    {/* Formula Input */}
                    <div className="mb-3">
                        <label htmlFor="formulaInput" className="form-label visually-hidden">
                            Enter your formula:
                        </label>
                        <input
                            type="text"
                            id="formulaInput"
                            value={userFormula}
                            onChange={(e) => setUserFormula(e.target.value)}
                            placeholder="Enter your formula (e.g., (10 + 5) * 2)"
                            className="form-control form-control-lg text-center bg-light text-dark"
                            aria-label="Enter your formula"
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="d-grid">
                        <button
                            onClick={handleFormulaSubmit}
                            // Disable if time ran out (and timer is active) OR if game isn't playing
                            disabled={(selectedTimeout !== null && timeLeft <= 0) || gameState !== 'playing'}
                            className="btn btn-success btn-lg mb-3 fw-bold"
                        >
                            Submit Formula
                        </button>
                    </div>

                    {/* Messages */}
                    {infoMessage && <p className="mt-3 text-warning text-center small">{infoMessage}</p>}
                    {errorMessage && <p className="mt-3 text-danger text-center small">{errorMessage}</p>}
                </div>
            </div>
        </div>
    );

    // Updated renderResults Function (using darker backgrounds)
    const renderResults = () => (
        <div className="container mt-4" style={{ maxWidth: '700px' }}>
            {/* Use bg-dark or similar for the main card */}
            <div className="card shadow border-secondary bg-dark text-light"> {/* Added bg-dark text-light here */}
                <div className="card-body p-md-4 p-3 rounded"> {/* Removed bg-dark from here as it's on parent */}
                    <h2 className="card-title text-center h3 mb-4 text-info">Round Over!</h2>

                    {/* Info/Score Message */}
                    {/* Use text classes directly for less emphasis than alerts */}
                    {infoMessage && !infoMessage.startsWith("Time's up") && <p className="text-center text-warning mb-3">{infoMessage}</p>}
                    {/* Keep danger alert for timeout */}
                    {infoMessage && infoMessage.startsWith("Time's up") && <div className="alert alert-danger text-center" role="alert">{infoMessage}</div>}

                    {/* User Result Section */}
                    {userResult !== null && (
                         // Use a dark card, maybe slightly different shade if desired (e.g., bg-black)
                        <div className="card bg-black border-primary p-3 mb-3 rounded">
                            {/* Ensure text is light */}
                            <p className="mb-1 text-white-50">Your target was: <strong className="text-success text-decoration-underline">{target}</strong></p>
                            <p className="mb-1 text-white-50">Your formula <code className="bg-secondary text-warning p-1 rounded small">{userFormula}</code> evaluated to: <strong className="text-info">{userResult}</strong></p>
                            <p className="mb-0 text-white-50">Difference: <strong className="text-danger">{Math.abs(userResult - target)}</strong></p>
                        </div>
                    )}
                    {/* Message if user didn't submit */}
                    {userResult === null && !infoMessage.startsWith("Time's up") && (
                         !errorMessage && <p className="mb-3 text-white-50 text-center">You didn't submit a formula.</p>
                    )}
                     {/* Error Message Alert */}
                     {errorMessage && userResult === null && <div className="alert alert-danger text-center" role="alert">{errorMessage}</div>}


                    {/* Computer solution card - Use dark background */}
                    {/* Match user result card background or use another dark shade */}
                    <div className="card bg-black border-secondary p-3 mb-4 rounded">
                        <h3 className="h5 mb-2 text-white-50">Computer's Solution:</h3>
                        {computerSolution ? (
                             // Ensure text is light and readable
                            <p className="text-light small lh-base" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{computerSolution}</p>
                        ) : (
                            <p className="text-white-50 small">Calculating computer's solution or none found...</p>
                        )}
                    </div>

                    {/* Score display - Use dark background with contrasting text */}
                    <div className="text-center fs-5 mb-4 p-3 bg-primary-subtle text-primary-emphasis rounded"> {/* Try primary subtle/emphasis */}
                        Total Score: <span className="fw-bold">{score.user}</span> after <span className="fw-bold">{score.rounds}</span> round(s).
                    </div>

                    {/* Play Again Button */}
                    <div className="d-grid">
                        <button
                            onClick={handlePlayAgain}
                            className="btn btn-primary btn-lg fw-bold" // Keep primary button
                        >
                            Play Another Round
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // Main container for the app
    return (
        <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 bg-black p-3">
            {gameState === 'setup' && renderSetup()}
            {gameState === 'playing' && renderPlaying()}
            {gameState === 'results' && renderResults()}
        </div>
    );
}

export default App;
