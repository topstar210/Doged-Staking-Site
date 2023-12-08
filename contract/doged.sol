// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract DOGED is ERC20, Ownable, Pausable, ReentrancyGuard {
    IERC20 public dogeToken;
    uint256 public unstakingCooldown = 0;
    uint256 public targetPrice = 100;
    uint256 public priceDecimals = 2;
    uint256 public stabilityBuffer = 5;
    uint256 public maxSupplyChange = 10;
    uint256 public targetSupply;
    bool public circuitBreakerEnabled;
    uint256 public highVolatilityThreshold = 2000;
    uint256 public lowVolatilityThreshold = 1000;
    address public authorizedAddress;

    AggregatorV3Interface[] public priceFeeds;

    event Staked(address indexed staker, uint256 amount);
    event Unstaked(address indexed staker, uint256 amount);
    event Minted(address indexed recipient, uint256 amount);
    event Burned(address indexed sender, uint256 amount);
    event PriceFeedAdded(address priceFeed);
    event PriceFeedRemoved(uint256 index);

    constructor(
        address _dogeTokenAddress,
        address _initialDogePriceFeedAddress,
        address initialOwner
    ) ERC20("DOGE Dollar", "DOGED") Ownable(initialOwner) {
        dogeToken = IERC20(_dogeTokenAddress);
        addPriceFeed(_initialDogePriceFeedAddress);
    }

    function totalSupply() public view override returns (uint256) {
        return super.totalSupply();
    }

    function addPriceFeed(address _priceFeedAddress) public onlyOwner {
        require(_priceFeedAddress != address(0), "Invalid address");
        priceFeeds.push(AggregatorV3Interface(_priceFeedAddress));
        emit PriceFeedAdded(_priceFeedAddress);
    }

    function removePriceFeed(uint256 index) public onlyOwner {
        require(index < priceFeeds.length, "Index out of bounds");
        emit PriceFeedRemoved(index);
        priceFeeds[index] = priceFeeds[priceFeeds.length - 1];
        priceFeeds.pop();
    }

    function getAveragePrice() public view returns (uint256) {
        uint256 totalPrice;
        uint256 count;
        for (uint256 i = 0; i < priceFeeds.length; i++) {
            (, int256 price, , , ) = priceFeeds[i].latestRoundData();
            if (price > 0) {
                totalPrice += uint256(price);
                count++;
            }
        }
        require(count > 0, "No valid oracle data");
        return totalPrice / count;
    }

    function stake(uint256 amount) external whenNotPaused nonReentrant { 
        require(amount > 0, "Amount must be greater than 0");
        // require(
        //     dogeToken.allowance(msg.sender, address(this)) >= amount,
        //     "Insufficient allowance"
        // );
        dogeToken.transferFrom( 
            msg.sender,
            address(this),
            amount
        );
        uint256 mintAmount = (amount * targetPrice) / (10 ** priceDecimals);
        _mint(msg.sender, mintAmount);
        emit Staked(msg.sender, amount);
        targetSupply = totalSupply();
    }

    function unstake(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(
            block.timestamp >= unstakingCooldown,
            "Unstaking is currently on cooldown"
        );

        uint256 dogeAmount = (amount * (10 ** priceDecimals)) / targetPrice;
        dogeToken.transfer(msg.sender, dogeAmount);
        _burn(msg.sender, amount);
        emit Unstaked(msg.sender, dogeAmount);
        targetSupply = totalSupply();
    }

    function stabilize() external onlyOwner {
        require(!circuitBreakerEnabled, "Circuit breaker activated");
        uint256 currentPrice = getAveragePrice();
        require(
            currentPrice <= highVolatilityThreshold &&
                currentPrice >= lowVolatilityThreshold,
            "Price out of bounds"
        );
        if (
            currentPrice > targetPrice + ((targetPrice * stabilityBuffer) / 100)
        ) {
            targetSupply = (targetSupply * (100 - maxSupplyChange)) / 100;
        } else if (
            currentPrice < targetPrice - ((targetPrice * stabilityBuffer) / 100)
        ) {
            targetSupply = (targetSupply * (100 + maxSupplyChange)) / 100;
        }
        uint256 currentSupply = totalSupply();
        if (currentSupply < targetSupply) {
            uint256 mintAmount = targetSupply - currentSupply;
            _mint(owner(), mintAmount);
            emit Minted(owner(), mintAmount);
        } else if (currentSupply > targetSupply) {
            uint256 burnAmount = currentSupply - targetSupply;
            _burn(owner(), burnAmount);
            emit Burned(owner(), burnAmount);
        }
    }

    function toggleCircuitBreaker(bool _enabled) external onlyOwner {
        circuitBreakerEnabled = _enabled;
    }

    function emergencyWithdrawDOGE(
        uint256 amount
    ) external onlyOwner whenNotPaused {
        require(circuitBreakerEnabled, "Circuit breaker not activated");
        dogeToken.transfer(owner(), amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setAuthorizedAddress(
        address _newAuthorizedAddress
    ) external onlyOwner {
        authorizedAddress = _newAuthorizedAddress;
    }

    modifier onlyOwnerOrAuthorized() {
        require(
            msg.sender == owner() || msg.sender == authorizedAddress,
            "Not owner or authorized"
        );
        _;
    }
}
