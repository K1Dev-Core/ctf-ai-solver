const { ipcRenderer } = require('electron');
const OpenAI = require('openai');

let openai = null;
let currentFile = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    checkFirstRun();
});

function initializeApp() {
    const apiKey = localStorage.getItem('openai_api_key');
    if (apiKey) {
        openai = new OpenAI({ apiKey: apiKey });
    }
}

function checkFirstRun() {
    const hasApiKey = localStorage.getItem('openai_api_key');
    if (!hasApiKey) {
        showSetupModal();
    }
}

function showSetupModal() {
    document.getElementById('setupModal').style.display = 'flex';
}

function hideSetupModal() {
    document.getElementById('setupModal').style.display = 'none';
}

function setupEventListeners() {
    document.getElementById('saveSetupApiKey').addEventListener('click', saveSetupApiKey);
    document.getElementById('settingsBtn').addEventListener('click', showSetupModal);
    document.getElementById('selectFileBtn').addEventListener('click', selectFile);
    document.getElementById('removeFile').addEventListener('click', removeFile);
    document.getElementById('analyzeBtn').addEventListener('click', analyzeFile);
    document.getElementById('copyResult').addEventListener('click', copyResult);

    const fileUploadArea = document.getElementById('fileUploadArea');
    
    fileUploadArea.addEventListener('dragover', handleDragOver);
    fileUploadArea.addEventListener('dragleave', handleDragLeave);
    fileUploadArea.addEventListener('drop', handleDrop);
    fileUploadArea.addEventListener('click', selectFile);
}

function saveSetupApiKey() {
    const apiKey = document.getElementById('setupApiKey').value.trim();
    if (!apiKey) {
        alert('Please enter your OpenAI API key');
        return;
    }
    
    localStorage.setItem('openai_api_key', apiKey);
    openai = new OpenAI({ apiKey: apiKey });
    hideSetupModal();
    alert('API key saved successfully!');
}

async function selectFile() {
    const filePath = await ipcRenderer.invoke('select-file');
    if (filePath) {
        handleFileSelection(filePath);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        handleFileSelection(file.path);
    }
}

async function handleFileSelection(filePath) {
    try {
        const result = await ipcRenderer.invoke('read-file', filePath);
        if (result.success) {
            currentFile = {
                path: filePath,
                name: filePath.split('\\').pop().split('/').pop(),
                content: result.data,
                size: result.data.length
            };
            
            displayFileInfo();
            showAnalysisSection();
        } else {
            alert('Unable to read file: ' + result.error);
        }
    } catch (error) {
        alert('Error occurred: ' + error.message);
    }
}

function displayFileInfo() {
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    
    fileName.textContent = currentFile.name;
    fileSize.textContent = formatFileSize(currentFile.size);
    
    fileInfo.style.display = 'block';
    document.getElementById('fileUploadArea').style.display = 'none';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showAnalysisSection() {
    document.getElementById('analysisSection').style.display = 'block';
}

function removeFile() {
    currentFile = null;
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('analysisSection').style.display = 'none';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('fileUploadArea').style.display = 'block';
}

async function analyzeFile() {
    if (!openai) {
        alert('Please configure your API key first');
        showSetupModal();
        return;
    }
    
    if (!currentFile) {
        alert('Please select a file first');
        return;
    }
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    const btnText = analyzeBtn.querySelector('.btn-text');
    const loadingSpinner = analyzeBtn.querySelector('.loading-spinner');
    
    analyzeBtn.disabled = true;
    btnText.style.display = 'none';
    loadingSpinner.style.display = 'inline';
    
    try {
        const result = await performCTFAnalysis();
        displayResult(result);
    } catch (error) {
        alert('Error during analysis: ' + error.message);
    } finally {
        analyzeBtn.disabled = false;
        btnText.style.display = 'flex';
        loadingSpinner.style.display = 'none';
    }
}

async function performCTFAnalysis() {
    const systemPrompt = `You are an expert CTF (Capture The Flag) solver with deep knowledge in:
- Cryptography
- Reverse Engineering
- Web Security
- Binary Analysis
- Steganography
- Digital Forensics
- Pwn (System Exploitation)
- Miscellaneous challenges

When given a file or data, analyze and find solutions for CTF challenges by:
1. Identifying the challenge type
2. Analyzing the provided data
3. Suggesting solution methods
4. Providing possible answers or flags
5. Explaining steps in detail

Respond in English with clear, concise, and actionable solutions`;

    const userPrompt = `File: ${currentFile.name}
Size: ${formatFileSize(currentFile.size)}
Content:
${currentFile.content}

Please analyze this file and find the CTF challenge solution`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.7
    });

    return completion.choices[0].message.content;
}

function displayResult(result) {
    const resultSection = document.getElementById('resultSection');
    const resultContent = document.getElementById('resultContent');
    
    resultContent.textContent = result;
    resultSection.style.display = 'block';
    
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

function copyResult() {
    const resultContent = document.getElementById('resultContent');
    const text = resultContent.textContent;
    
    navigator.clipboard.writeText(text).then(() => {
        const copyBtn = document.getElementById('copyResult');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        copyBtn.style.background = '#28a745';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.style.background = '#17a2b8';
        }, 2000);
    }).catch(err => {
        alert('Unable to copy: ' + err.message);
    });
}
