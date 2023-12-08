import "./style.css";
import { ethers, parseEther, parseUnits } from 'ethers';
import { contractABI, wwDogeTokenABI } from "./ABIs.js";

// 0x9A98280A6818ed8AFd500cC378ACcf92fcc13Fe0 
// 0x617C6420dB84992f5C0776038839599A285f836D missed dogeToken.allowance
// 0x31924Aa3F1e3df30E8eA5BE5EcB208CB65A36e7f missed dogetoken.transferFrom and allowance
// 0x37551909564B3b966598046c26078919e61e7FBD stake token is eve 
const contractAddress = '0x37551909564B3b966598046c26078919e61e7FBD';
// 0xB7ddC6414bf4F5515b52D8BdD69973Ae205ff101 wdoge address on dogechain mainnet
// 0x70acE47D53A8A2C8BfB6b4e5755291570D2449A3  eve token address
const wwDogeTokenAddress = "0x70acE47D53A8A2C8BfB6b4e5755291570D2449A3";
let signer = null;
let account, provider, contract, wwDogeTokenContract;

async function connectWallet() {
  try {
    if (window.ethereum == null) {
      alert("MetaMask not installed; using read-only defaults");
      provider = ethers.getDefaultProvider();
    } else {
      provider = new ethers.BrowserProvider(window.ethereum)
      signer = await provider.getSigner();
    }

    account = signer.address;
    document.getElementById('connectedWalletAddress').textContent = account;
    document.getElementById('connectWallet').style.display='none'
    console.log('Connected to MetaMask');
  } catch (error) {
    handleError('MetaMask connection error', error);
  }
}

async function checkAndApproveToken(etherAmount) { 
  try {
    const allowance = await wwDogeTokenContract.allowance(account, contractAddress);
    console.log('checkAndApproveToken', allowance.toString());
  
    if (allowance < etherAmount) {
      const tx = await wwDogeTokenContract.approve(contractAddress, etherAmount);
      await tx.wait();
    }
  } catch (error) {
    handleError('Approval error', error);
  }
}
  
async function stakeTokens() {
  const amount = document.getElementById('stakeAmount').value;
  if (amount <= 0) {
    updateMessage('Please enter a valid amount to stake.', true);
    return;
  }

  const etherAmount = parseEther(amount.toString());
  await checkAndApproveToken(etherAmount);

  try {
    const gasEstimate = await contract.stake.estimateGas(etherAmount);
    const gasLimit = gasEstimate + BigInt(3000);
    const gasPrice = parseUnits('15', 'gwei');
    const tx = await contract.stake(etherAmount, { gasLimit, gasPrice });
    await tx.wait();

    updateContractInfo();
    updateMessage("Stake transaction successful.");
  } catch (error) {
    handleError('Staking error', error);
  }
}

async function unstakeTokens() {
  const amount = document.getElementById('unstakeAmount').value;
  if (amount <= 0) {
    updateMessage('Please enter a valid amount to unstake.', true);
    return;
  }

  try {
    const etherAmount = parseEther(amount.toString());
    const tx = await contract.unstake(etherAmount);
    await tx.wait;
    await updateContractInfo();
    updateMessage("Unstake transaction successful.");
  } catch (error) {
    handleError('Unstaking error', error);
  }
}

async function updateContractInfo() {
  try {
    const totalSupply = await contract.totalSupply();
    const userBalance = await contract.balanceOf(account);

    document.getElementById('totalSupply').textContent = totalSupply.toString();
    document.getElementById('userBalance').textContent = userBalance.toString();
  } catch (error) {
    handleError('Error updating contract info', error);
  }
}

function updateMessage(message, isError = false) {
  const messageElement = document.getElementById('transactionMessage');
  messageElement.textContent = message;
  messageElement.style.color = isError ? 'red' : 'green';
  setTimeout(() => messageElement.textContent = '', 5000); // Clear message after 5 seconds
}

function handleError(errorMessage, error) {
  console.error(errorMessage, error);
  updateMessage(`${errorMessage}: ${error.message}`, true);
}

async function init() {
  await connectWallet();
  contract = new ethers.Contract(contractAddress, contractABI, signer);
  wwDogeTokenContract = new ethers.Contract(wwDogeTokenAddress, wwDogeTokenABI, signer);

  document.getElementById('connectWallet').addEventListener('click', connectWallet);
  document.getElementById('stakeButton').addEventListener('click', stakeTokens);
  document.getElementById('unstakeButton').addEventListener('click', unstakeTokens);
  updateContractInfo();
}

init();
