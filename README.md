# GeoAd_FHE: Private Location-Based Marketing

GeoAd_FHE is an innovative application that leverages Zama's Fully Homomorphic Encryption (FHE) technology to redefine location-based marketing while ensuring user privacy. By utilizing advanced encryption techniques, GeoAd_FHE allows businesses to deliver personalized offers to users without compromising their location data, creating a trust-filled marketing environment.

## The Problem

In the rapidly evolving ad tech landscape, businesses rely on location data to target potential customers effectively. However, handling such sensitive information can expose users to privacy risks, including unauthorized data access and misuse. Cleartext location data can lead to significant repercussions, including data breaches and diminished user trust. Thus, the need for a solution that preserves location privacy while enabling effective marketing strategies is critical.

## The Zama FHE Solution

Zama's Fully Homomorphic Encryption technology offers a robust solution to the privacy challenges faced in location-based marketing. By enabling computation on encrypted data, GeoAd_FHE facilitates marketing strategies without exposing user location information in cleartext. 

Using the Zama library, GeoAd_FHE processes encrypted inputs to match users with nearby offers securely. The result is a privacy-centric system where companies can deliver localized promotions while safeguarding sensitive user data.

## Key Features

- 🔒 **Privacy Protection**: Users' location information is encrypted, ensuring anonymity and safeguarding against data theft.
- 🎯 **Targeted Offers**: Businesses can deploy marketing campaigns based on encrypted location data, allowing for tailored promotions that respect user privacy.
- 📍 **Geographic Radius Encryption**: The application enables merchants to set encrypted geographical boundaries for promotions, enhancing the relevance of targeted offers.
- 📈 **Analytics without Exposure**: Gain insights into user behavior based on encrypted data without revealing individual user details.
- 🗺️ **Interactive Coupon Map**: Users can explore offers in their vicinity through a completely secure and encrypted map interface.

## Technical Architecture & Stack

GeoAd_FHE is built on a solid foundation featuring the following technology stack:

- **Core Privacy Engine**: Zama's Fully Homomorphic Encryption (FHE)
- **Frontend**: React.js
- **Backend**: Node.js
- **Database**: MongoDB
- **Libraries**: 
  - Zama's FHE libraries (e.g., fhevm, Concrete ML)

## Smart Contract / Core Logic

Below is a simplified pseudo-code example demonstrating how GeoAd_FHE processes user location data securely using Zama's technology:solidity
// Solidity example for calculating an encrypted distance match
pragma solidity ^0.8.0;

contract GeoAd {
    struct EncryptedLocation {
        uint64 encryptedLatitude;
        uint64 encryptedLongitude;
    }

    function matchOffer(EncryptedLocation userLocation, EncryptedLocation offerLocation) public view returns (bool) {
        // Perform encrypted distance calculations using TFHE's homomorphic operations
        return TFHE.distance(userLocation, offerLocation) < ENCRYPTED_ALLOWED_RADIUS;
    }
}

## Directory Structure

The project structure is organized as follows:
GeoAd_FHE/
├── contracts/
│   └── GeoAd.sol
├── src/
│   ├── components/
│   │   └── CouponMap.js
│   ├── services/
│   │   └── locationService.js
│   └── App.js
├── scripts/
│   ├── deploy.js
│   └── interact.js
├── tests/
│   └── GeoAd.test.js
├── .env
├── package.json
└── README.md

## Installation & Setup

### Prerequisites

To get started with GeoAd_FHE, ensure you have Node.js and npm installed on your machine.

### Installing Dependencies

1. Install required packages:bash
   npm install express mongoose

2. Install the Zama library:bash
   npm install fhevm

## Build & Run

To build and run the application, execute the following commands:

1. Compile the smart contracts:bash
   npx hardhat compile

2. Start the backend server:bash
   node src/index.js

3. Launch the frontend:bash
   npm start

## Acknowledgements

We extend our gratitude to Zama for providing the open-source FHE primitives that make GeoAd_FHE possible. Their pioneering technology enables us to redefine location-based marketing while placing user privacy at the forefront.


