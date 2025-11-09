import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface CouponData {
  id: string;
  name: string;
  encryptedRadius: string;
  discount: number;
  category: number;
  description: string;
  timestamp: number;
  creator: string;
  isVerified?: boolean;
  decryptedValue?: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<CouponData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingCoupon, setCreatingCoupon] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newCouponData, setNewCouponData] = useState({ 
    name: "", 
    radius: "", 
    discount: "", 
    category: "1",
    description: "" 
  });
  const [selectedCoupon, setSelectedCoupon] = useState<CouponData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [showStats, setShowStats] = useState(false);
  const itemsPerPage = 6;

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized) return;
      try {
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      try {
        await loadData();
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const couponsList: CouponData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          couponsList.push({
            id: businessId,
            name: businessData.name,
            encryptedRadius: businessId,
            discount: Number(businessData.publicValue1) || 0,
            category: Number(businessData.publicValue2) || 1,
            description: businessData.description,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setCoupons(couponsList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createCoupon = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingCoupon(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating encrypted coupon..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const radiusValue = parseInt(newCouponData.radius) || 0;
      const businessId = `coupon-${Date.now()}`;
      const contractAddress = await contract.getAddress();
      
      const encryptedResult = await encrypt(contractAddress, address, radiusValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newCouponData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newCouponData.discount) || 0,
        parseInt(newCouponData.category) || 1,
        newCouponData.description
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction..." });
      await tx.wait();
      
      addUserHistory("CREATE_COUPON", { name: newCouponData.name, radius: radiusValue });
      
      setTransactionStatus({ visible: true, status: "success", message: "Coupon created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewCouponData({ name: "", radius: "", discount: "", category: "1", description: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Creation failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingCoupon(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Data already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        addUserHistory("VERIFY_COUPON", { id: businessId, radius: storedValue });
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      const contractAddress = await contractRead.getAddress();
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      await loadData();
      
      addUserHistory("VERIFY_COUPON", { id: businessId, radius: Number(clearValue) });
      
      setTransactionStatus({ visible: true, status: "success", message: "Data verified successfully!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Data is already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
  };

  const addUserHistory = (action: string, data: any) => {
    const historyItem = {
      action,
      data,
      timestamp: Date.now(),
      address
    };
    setUserHistory(prev => [historyItem, ...prev.slice(0, 9)]);
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ visible: true, status: "success", message: "Contract is available!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredCoupons = coupons.filter(coupon => 
    coupon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coupon.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedCoupons = filteredCoupons.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredCoupons.length / itemsPerPage);

  const stats = {
    totalCoupons: coupons.length,
    verifiedCoupons: coupons.filter(c => c.isVerified).length,
    averageDiscount: coupons.length > 0 ? coupons.reduce((sum, c) => sum + c.discount, 0) / coupons.length : 0,
    userCoupons: coupons.filter(c => c.creator === address).length
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>GeoAd FHE 🔐</h1>
            <p>位置隐私营销平台</p>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🗺️🔐</div>
            <h2>连接钱包体验位置隐私营销</h2>
            <p>基于FHE全同态加密技术，保护您的位置隐私同时享受精准优惠</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>连接钱包初始化FHE加密系统</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>创建或浏览加密位置优惠券</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>安全验证和解密优惠范围</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>初始化FHE加密系统...</p>
        <p className="loading-note">正在准备位置隐私保护环境</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>加载加密优惠券数据...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <h1>GeoAd FHE 🔐</h1>
          <p>Private Location-Based Marketing</p>
        </div>
        
        <div className="header-actions">
          <button onClick={checkAvailability} className="availability-btn">
            检查合约
          </button>
          <button onClick={() => setShowStats(!showStats)} className="stats-btn">
            数据统计
          </button>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            + 创建优惠券
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>

      {showStats && (
        <div className="stats-panel">
          <div className="stat-card">
            <h3>总优惠券</h3>
            <div className="stat-value">{stats.totalCoupons}</div>
          </div>
          <div className="stat-card">
            <h3>已验证</h3>
            <div className="stat-value">{stats.verifiedCoupons}</div>
          </div>
          <div className="stat-card">
            <h3>平均折扣</h3>
            <div className="stat-value">{stats.averageDiscount.toFixed(1)}%</div>
          </div>
          <div className="stat-card">
            <h3>我的优惠券</h3>
            <div className="stat-value">{stats.userCoupons}</div>
          </div>
        </div>
      )}

      <div className="search-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索优惠券名称或描述..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button onClick={loadData} className="refresh-btn" disabled={isRefreshing}>
            {isRefreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      <div className="content-grid">
        <div className="main-content">
          <div className="section-header">
            <h2>加密位置优惠券</h2>
            <div className="pagination-controls">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="page-btn"
              >
                上一页
              </button>
              <span>第 {currentPage} 页，共 {totalPages} 页</span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="page-btn"
              >
                下一页
              </button>
            </div>
          </div>

          <div className="coupons-grid">
            {paginatedCoupons.length === 0 ? (
              <div className="no-coupons">
                <p>未找到优惠券</p>
                <button onClick={() => setShowCreateModal(true)} className="create-btn">
                  创建第一个优惠券
                </button>
              </div>
            ) : (
              paginatedCoupons.map((coupon, index) => (
                <div 
                  className={`coupon-card ${coupon.isVerified ? "verified" : ""}`}
                  key={index}
                  onClick={() => setSelectedCoupon(coupon)}
                >
                  <div className="coupon-header">
                    <h3>{coupon.name}</h3>
                    <span className={`status-badge ${coupon.isVerified ? "verified" : "pending"}`}>
                      {coupon.isVerified ? "✅ 已验证" : "🔓 待验证"}
                    </span>
                  </div>
                  <div className="coupon-discount">{coupon.discount}% OFF</div>
                  <div className="coupon-description">{coupon.description}</div>
                  <div className="coupon-meta">
                    <span>范围: {coupon.isVerified ? `${coupon.decryptedValue}米` : "🔒 加密"}</span>
                    <span>创建者: {coupon.creator.substring(0, 6)}...{coupon.creator.substring(38)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sidebar">
          <div className="user-history">
            <h3>操作记录</h3>
            {userHistory.length === 0 ? (
              <p>暂无操作记录</p>
            ) : (
              <div className="history-list">
                {userHistory.map((item, index) => (
                  <div key={index} className="history-item">
                    <span className="history-action">
                      {item.action === "CREATE_COUPON" ? "创建优惠券" : "验证优惠券"}
                    </span>
                    <span className="history-time">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="fhe-info-panel">
            <h3>FHE加密流程</h3>
            <div className="fhe-step">
              <div className="step-number">1</div>
              <div className="step-content">位置半径加密存储</div>
            </div>
            <div className="fhe-step">
              <div className="step-number">2</div>
              <div className="step-content">本地范围匹配计算</div>
            </div>
            <div className="fhe-step">
              <div className="step-number">3</div>
              <div className="step-content">离线解密验证</div>
            </div>
            <div className="fhe-step">
              <div className="step-number">4</div>
              <div className="step-content">链上签名确认</div>
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <ModalCreateCoupon 
          onSubmit={createCoupon} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingCoupon} 
          couponData={newCouponData} 
          setCouponData={setNewCouponData}
          isEncrypting={isEncrypting}
        />
      )}

      {selectedCoupon && (
        <CouponDetailModal 
          coupon={selectedCoupon} 
          onClose={() => setSelectedCoupon(null)} 
          isDecrypting={fheIsDecrypting} 
          decryptData={() => decryptData(selectedCoupon.id)}
        />
      )}

      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateCoupon: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  couponData: any;
  setCouponData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, couponData, setCouponData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'radius' || name === 'discount') {
      const intValue = value.replace(/[^\d]/g, '');
      setCouponData({ ...couponData, [name]: intValue });
    } else {
      setCouponData({ ...couponData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-coupon-modal">
        <div className="modal-header">
          <h2>创建加密位置优惠券</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE位置隐私保护</strong>
            <p>优惠券范围半径将使用Zama FHE加密，确保位置隐私安全</p>
          </div>
          
          <div className="form-group">
            <label>优惠券名称 *</label>
            <input 
              type="text" 
              name="name" 
              value={couponData.name} 
              onChange={handleChange} 
              placeholder="输入优惠券名称..." 
            />
          </div>
          
          <div className="form-group">
            <label>范围半径(米) *</label>
            <input 
              type="number" 
              name="radius" 
              value={couponData.radius} 
              onChange={handleChange} 
              placeholder="输入范围半径..." 
              min="0"
            />
            <div className="data-type-label">FHE加密整数</div>
          </div>
          
          <div className="form-group">
            <label>折扣比例(%) *</label>
            <input 
              type="number" 
              name="discount" 
              value={couponData.discount} 
              onChange={handleChange} 
              placeholder="输入折扣比例..." 
              min="1"
              max="100"
            />
            <div className="data-type-label">公开数据</div>
          </div>
          
          <div className="form-group">
            <label>分类</label>
            <select name="category" value={couponData.category} onChange={handleChange}>
              <option value="1">餐饮美食</option>
              <option value="2">购物零售</option>
              <option value="3">娱乐休闲</option>
              <option value="4">生活服务</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>描述</label>
            <textarea 
              name="description" 
              value={couponData.description} 
              onChange={handleChange} 
              placeholder="输入优惠券描述..." 
              rows={3}
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">取消</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !couponData.name || !couponData.radius || !couponData.discount} 
            className="submit-btn"
          >
            {creating || isEncrypting ? "加密创建中..." : "创建优惠券"}
          </button>
        </div>
      </div>
    </div>
  );
};

const CouponDetailModal: React.FC<{
  coupon: CouponData;
  onClose: () => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ coupon, onClose, isDecrypting, decryptData }) => {
  const [decryptedRadius, setDecryptedRadius] = useState<number | null>(null);

  const handleDecrypt = async () => {
    if (coupon.isVerified) return;
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setDecryptedRadius(decrypted);
    }
  };

  const getCategoryName = (category: number) => {
    const categories = ["", "餐饮美食", "购物零售", "娱乐休闲", "生活服务"];
    return categories[category] || "其他";
  };

  return (
    <div className="modal-overlay">
      <div className="coupon-detail-modal">
        <div className="modal-header">
          <h2>优惠券详情</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="coupon-info">
            <div className="info-row">
              <span>名称:</span>
              <strong>{coupon.name}</strong>
            </div>
            <div className="info-row">
              <span>分类:</span>
              <strong>{getCategoryName(coupon.category)}</strong>
            </div>
            <div className="info-row">
              <span>折扣:</span>
              <strong className="discount-highlight">{coupon.discount}% OFF</strong>
            </div>
            <div className="info-row">
              <span>创建者:</span>
              <strong>{coupon.creator.substring(0, 6)}...{coupon.creator.substring(38)}</strong>
            </div>
            <div className="info-row">
              <span>创建时间:</span>
              <strong>{new Date(coupon.timestamp * 1000).toLocaleString()}</strong>
            </div>
          </div>
          
          <div className="description-section">
            <h3>描述</h3>
            <p>{coupon.description}</p>
          </div>
          
          <div className="encryption-section">
            <h3>位置范围加密数据</h3>
            <div className="radius-info">
              <div className="radius-value">
                {coupon.isVerified ? 
                  `验证范围: ${coupon.decryptedValue}米` : 
                  decryptedRadius !== null ? 
                  `解密范围: ${decryptedRadius}米` : 
                  "🔒 加密范围半径"
                }
              </div>
              <button 
                className={`decrypt-btn ${(coupon.isVerified || decryptedRadius !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting || coupon.isVerified}
              >
                {isDecrypting ? "验证中..." : 
                 coupon.isVerified ? "✅ 已验证" : 
                 decryptedRadius !== null ? "🔄 重新验证" : 
                 "🔓 验证范围"}
              </button>
            </div>
            
            <div className="fhe-explanation">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>同态加密保护</strong>
                <p>范围半径在链上加密存储，只有通过验证才能安全解密</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">关闭</button>
          {!coupon.isVerified && (
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="verify-btn"
            >
              {isDecrypting ? "链上验证中..." : "链上验证"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;


