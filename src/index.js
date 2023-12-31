import "./style.css";
import { ethers, parseEther, parseUnits } from 'ethers';
import * as toastr from "toastr"
import "toastr/build/toastr.min.css";

import { contractABI, wwDogeTokenABI } from "./ABIs.js";

// 0x617C6420dB84992f5C0776038839599A285f836D missed dogeToken.allowance
// 0x37551909564B3b966598046c26078919e61e7FBD stake token is eve 
const contractAddress = '0x31Bfad07123fF55E3A2897111A7caf3B55Bfe2D9';
// 0xB7ddC6414bf4F5515b52D8BdD69973Ae205ff101 wdoge address on dogechain mainnet
// 0x70acE47D53A8A2C8BfB6b4e5755291570D2449A3 eve token address
// 0x7B4328c127B85369D9f82ca0503B000D09CF9180 DC token
const wwDogeTokenAddress = "0x7B4328c127B85369D9f82ca0503B000D09CF9180";
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
    const network = await provider.getNetwork();
    if(network?.chainId !== BigInt(2000)){
      toastr.info("Please select Dogechain.");
      return;
    }

    account = signer.address;
    const shortenedAddress = `${account.substring(0, 6)}...${account.substring(38)}`;
    document.getElementById('connectedWalletAddress').textContent = shortenedAddress;
    document.getElementById('connectWallet').style.display = 'none';
    document.getElementById('walletInfo').style.display = 'block';
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
    return true;
  } catch (error) {
    handleError('Approval error', error);
    return false;
  }
}

async function stakeTokens() {
  const amount = document.getElementById('stakeAmount').value;
  if (amount <= 0) {
    updateMessage('Please enter a valid amount to stake.', true);
    return;
  }

  const etherAmount = parseEther(amount.toString());
  const chker = await checkAndApproveToken(etherAmount);
  if(!chker) return;

  try {
    const tx = await contract.stake(etherAmount);
    await tx.wait();

    updateContractInfo();
    updateMessage("Stake transaction successful.");
    document.getElementById('stakeAmount').value = '';
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
    document.getElementById('unstakeAmount').value = '';
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
  if(!isError) {
    toastr.success(message);
  } else {
    toastr.error(message);
  }
}

function handleError(errorMessage, error) {
  console.error(errorMessage, error);
  updateMessage(`${errorMessage}:<br /> ${error.message}`, true);
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
