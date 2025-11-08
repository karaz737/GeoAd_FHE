pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract GeoAdFHE is ZamaEthereumConfig {
    
    struct Business {
        string name;                    
        euint32 encryptedRadius;        
        uint256 publicLatitude;         
        uint256 publicLongitude;        
        string description;             
        address creator;                
        uint256 timestamp;              
        uint32 decryptedRadius;         
        bool isVerified;                
    }
    
    struct User {
        euint32 encryptedLatitude;      
        euint32 encryptedLongitude;     
        address userAddress;            
        uint256 timestamp;              
    }
    
    struct Coupon {
        string businessId;              
        string couponCode;              
        string description;             
        uint256 expiration;             
        bool isActive;                  
    }
    
    mapping(string => Business) public businesses;
    mapping(address => User) public users;
    mapping(string => Coupon) public coupons;
    
    string[] public businessIds;
    string[] public couponIds;
    
    event BusinessRegistered(string indexed businessId, address indexed creator);
    event UserLocationUpdated(address indexed userAddress);
    event CouponCreated(string indexed couponId, string indexed businessId);
    event DecryptionVerified(string indexed businessId, uint32 decryptedRadius);
    event MatchFound(string indexed couponId, address indexed userAddress);
    
    constructor() ZamaEthereumConfig() {
    }
    
    function registerBusiness(
        string calldata businessId,
        string calldata name,
        externalEuint32 encryptedRadius,
        bytes calldata radiusProof,
        uint256 publicLatitude,
        uint256 publicLongitude,
        string calldata description
    ) external {
        require(bytes(businesses[businessId].name).length == 0, "Business already exists");
        
        require(FHE.isInitialized(FHE.fromExternal(encryptedRadius, radiusProof)), "Invalid encrypted radius");
        
        businesses[businessId] = Business({
            name: name,
            encryptedRadius: FHE.fromExternal(encryptedRadius, radiusProof),
            publicLatitude: publicLatitude,
            publicLongitude: publicLongitude,
            description: description,
            creator: msg.sender,
            timestamp: block.timestamp,
            decryptedRadius: 0,
            isVerified: false
        });
        
        FHE.allowThis(businesses[businessId].encryptedRadius);
        FHE.makePubliclyDecryptable(businesses[businessId].encryptedRadius);
        
        businessIds.push(businessId);
        emit BusinessRegistered(businessId, msg.sender);
    }
    
    function updateUserLocation(
        externalEuint32 encryptedLatitude,
        bytes calldata latProof,
        externalEuint32 encryptedLongitude,
        bytes calldata lonProof
    ) external {
        require(FHE.isInitialized(FHE.fromExternal(encryptedLatitude, latProof)), "Invalid encrypted latitude");
        require(FHE.isInitialized(FHE.fromExternal(encryptedLongitude, lonProof)), "Invalid encrypted longitude");
        
        users[msg.sender] = User({
            encryptedLatitude: FHE.fromExternal(encryptedLatitude, latProof),
            encryptedLongitude: FHE.fromExternal(encryptedLongitude, lonProof),
            userAddress: msg.sender,
            timestamp: block.timestamp
        });
        
        FHE.allowThis(users[msg.sender].encryptedLatitude);
        FHE.allowThis(users[msg.sender].encryptedLongitude);
        
        emit UserLocationUpdated(msg.sender);
    }
    
    function createCoupon(
        string calldata couponId,
        string calldata businessId,
        string calldata couponCode,
        string calldata description,
        uint256 expiration
    ) external {
        require(bytes(coupons[couponId].couponCode).length == 0, "Coupon already exists");
        require(bytes(businesses[businessId].name).length > 0, "Business does not exist");
        
        coupons[couponId] = Coupon({
            businessId: businessId,
            couponCode: couponCode,
            description: description,
            expiration: expiration,
            isActive: true
        });
        
        couponIds.push(couponId);
        emit CouponCreated(couponId, businessId);
    }
    
    function verifyBusinessDecryption(
        string calldata businessId, 
        bytes memory abiEncodedClearRadius,
        bytes memory decryptionProof
    ) external {
        require(bytes(businesses[businessId].name).length > 0, "Business does not exist");
        require(!businesses[businessId].isVerified, "Business already verified");
        
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(businesses[businessId].encryptedRadius);
        
        FHE.checkSignatures(cts, abiEncodedClearRadius, decryptionProof);
        
        uint32 decodedRadius = abi.decode(abiEncodedClearRadius, (uint32));
        
        businesses[businessId].decryptedRadius = decodedRadius;
        businesses[businessId].isVerified = true;
        
        emit DecryptionVerified(businessId, decodedRadius);
    }
    
    function findMatchingCoupons() external returns (string[] memory) {
        require(users[msg.sender].userAddress != address(0), "User location not set");
        
        string[] memory matches = new string[](couponIds.length);
        uint256 matchCount;
        
        for (uint256 i = 0; i < couponIds.length; i++) {
            string memory couponId = couponIds[i];
            if (!coupons[couponId].isActive) continue;
            
            string memory businessId = coupons[couponId].businessId;
            Business storage business = businesses[businessId];
            
            if (!business.isVerified) continue;
            
            uint32 distance = calculateEncryptedDistance(
                business.publicLatitude,
                business.publicLongitude,
                users[msg.sender].encryptedLatitude,
                users[msg.sender].encryptedLongitude
            );
            
            if (distance <= business.decryptedRadius) {
                matches[matchCount] = couponId;
                matchCount++;
                emit MatchFound(couponId, msg.sender);
            }
        }
        
        assembly {
            mstore(matches, matchCount)
        }
        return matches;
    }
    
    function calculateEncryptedDistance(
        uint256 publicLat,
        uint256 publicLon,
        euint32 encryptedUserLat,
        euint32 encryptedUserLon
    ) internal returns (uint32) {
        euint32 encryptedDistance = FHE.sub(
            FHE.add(
                FHE.mul(encryptedUserLat, encryptedUserLat),
                FHE.mul(encryptedUserLon, encryptedUserLon)
            ),
            FHE.add(
                FHE.mul(FHE.constant(publicLat), FHE.constant(publicLat)),
                FHE.mul(FHE.constant(publicLon), FHE.constant(publicLon))
            )
        );
        
        return FHE.decrypt(encryptedDistance);
    }
    
    function getBusiness(string calldata businessId) external view returns (
        string memory name,
        uint256 publicLatitude,
        uint256 publicLongitude,
        string memory description,
        address creator,
        uint256 timestamp,
        bool isVerified,
        uint32 decryptedRadius
    ) {
        require(bytes(businesses[businessId].name).length > 0, "Business does not exist");
        Business storage business = businesses[businessId];
        
        return (
            business.name,
            business.publicLatitude,
            business.publicLongitude,
            business.description,
            business.creator,
            business.timestamp,
            business.isVerified,
            business.decryptedRadius
        );
    }
    
    function getCoupon(string calldata couponId) external view returns (
        string memory businessId,
        string memory couponCode,
        string memory description,
        uint256 expiration,
        bool isActive
    ) {
        require(bytes(coupons[couponId].couponCode).length > 0, "Coupon does not exist");
        Coupon storage coupon = coupons[couponId];
        
        return (
            coupon.businessId,
            coupon.couponCode,
            coupon.description,
            coupon.expiration,
            coupon.isActive
        );
    }
    
    function getUser(address userAddress) external view returns (
        euint32 encryptedLatitude,
        euint32 encryptedLongitude,
        uint256 timestamp
    ) {
        require(users[userAddress].userAddress != address(0), "User not found");
        User storage user = users[userAddress];
        
        return (
            user.encryptedLatitude,
            user.encryptedLongitude,
            user.timestamp
        );
    }
    
    function getAllBusinessIds() external view returns (string[] memory) {
        return businessIds;
    }
    
    function getAllCouponIds() external view returns (string[] memory) {
        return couponIds;
    }
    
    function isAvailable() public pure returns (bool) {
        return true;
    }
}


