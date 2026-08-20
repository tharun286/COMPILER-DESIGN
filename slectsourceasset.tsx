import { useState, useMemo, useEffect } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Sparkles, X, Search, Star, Clock, TrendingUp, Lightbulb, CheckCircle2, Eye, Download, AlertCircle, Loader2, RefreshCw, FileUp } from 'lucide-react';
import { Document } from '../../hls_main_page';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { flask_url, middleware_url} from '../../../utils/constants';
import doclogo from '../../assets/doclogo.png';
import { DomainType } from '../../context/DomainContext';

type SelectSourceAssetProps = {
  selectedAssets: Document[];
  domain: DomainType;
  onAssetsChange: (assets: Document[]) => void;
  weightagesEnabled?: boolean;
  onWeightagesEnabledChange?: (enabled: boolean) => void;
  assetWeights?: Record<string, number>;
  onAssetWeightsChange?: (weights: Record<string, number>) => void;
  isStandalone?: boolean;
  onConvertClick?: () => void;
  onHistoryClick?: () => void;
};

export function SelectSourceAsset({
  selectedAssets,
  domain,
  onAssetsChange,
  weightagesEnabled = false,
  onWeightagesEnabledChange,
  assetWeights = {},
  onAssetWeightsChange,
  isStandalone = false,
  onConvertClick,
  onHistoryClick,
}: SelectSourceAssetProps) {
  // Modal and tab state
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetModalTab, setAssetModalTab] = useState<'favorites' | 'recent' | 'frequent' | 'recommended'>('favorites');
  const [touchedWeights, setTouchedWeights] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<Record<string, 'view' | 'download'>>({});
  const [abortControllers, setAbortControllers] = useState<Record<string, AbortController>>({});

  // Search and filter states
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [selectedBrandFilters, setSelectedBrandFilters] = useState<string[]>([]);
  const [selectedAssetTypeFilters, setSelectedAssetTypeFilters] = useState<string[]>([]);
  const [selectedMarketFilters, setSelectedMarketFilters] = useState<string[]>([]);

  // Usage/budget state
  const [usageData, setUsageData] = useState<{ today_cost: number, daily_cost_limit: number } | null>(null);

  useEffect(() => {
    const loadUsage = () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      fetch(`${middleware_url}/crud/aibuddy/usage_metrics/me/usage`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.json())
        .then(data => setUsageData(data))
        .catch(e => console.error("Failed to load usage", e));
    };

    loadUsage();
    window.addEventListener('refresh-usage', loadUsage);
    return () => window.removeEventListener('refresh-usage', loadUsage);
  }, []);

  // Pagination states
  const [assetPage, setAssetPage] = useState(1);
  const assetsPerPage = 6;

  // API data states
  const [veevaDocuments, setVeevaDocuments] = useState<any[]>([]);
  const [localUploads, setLocalUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Warning dialog state
  const [showLimitWarning, setShowLimitWarning] = useState(false);

  // Debounce search query
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(assetSearchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [assetSearchQuery]);

  // Fetch Veeva files from API
  useEffect(() => {
    const fetchVeevaFiles = async () => {
      if (domain === 'sales' && !debouncedQuery.trim()) {
        setVeevaDocuments([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const queryParam = domain === 'sales' && debouncedQuery.trim() ? `&q=${encodeURIComponent(debouncedQuery)}` : '';
        const response = await fetch(`${middleware_url}/batch_process/hls_platform/veeva_files?domain=${domain}${queryParam}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch files');
        }
        const data = await response.json();
        // Filter only Approved documents
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.pptx', '.xlsx'];
        const approvedDocuments = (data.files || []).filter((file: any) =>
          (file.status || '').toLowerCase().includes('approved') &&
          (file.domain === domain) &&
          allowedExtensions.some(ext => (file.filename || '').toLowerCase().endsWith(ext))
        );
        setVeevaDocuments(approvedDocuments);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching files:', err);
      } finally {
        setLoading(false);
      }
    };

    if (domain === 'sales') {
      fetchVeevaFiles();
    } else if (veevaDocuments.length === 0) {
      fetchVeevaFiles();
    }
  }, [domain, debouncedQuery, refreshKey]);

  // Helper function to format filename with max 35 chars + extension
  const formatFileName = (filename: string) => {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // No extension
      return filename.length > 35 ? filename.substring(0, 35) + '...' : filename;
    }
    const name = filename.substring(0, lastDotIndex);
    const extension = filename.substring(lastDotIndex);

    if (name.length > 35) {
      return name.substring(0, 35) + '...' + extension;
    }
    return filename;
  };

  // Toggle selection handlers
  const toggleAssetSelection = (asset: Document) => {
    const isSelected = selectedAssets.find(a => a.id === asset.id);
    if (!isSelected && selectedAssets.length >= 3) {
      setShowLimitWarning(true);
      return;
    }
    const newAssets = isSelected
      ? selectedAssets.filter(a => a.id !== asset.id)
      : [...selectedAssets, asset];
    onAssetsChange(newAssets);
  };

  const removeAsset = (assetId: any) => {
    onAssetsChange(selectedAssets.filter(a => a.id !== assetId));
  };

  const handleCancelAction = (assetId: string) => {
    if (abortControllers[assetId]) {
      abortControllers[assetId].abort();
      setAbortControllers(prev => {
        const next = { ...prev };
        delete next[assetId];
        return next;
      });
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[assetId];
        return next;
      });
    }
  };

  const handleViewAsset = async (asset: Document) => {
    try {
      const controller = new AbortController();
      setAbortControllers(prev => ({ ...prev, [asset.id]: controller }));
      setActionLoading(prev => ({ ...prev, [asset.id]: 'view' }));
      
      if ((asset as any).web_url) {
        window.open((asset as any).web_url, '_blank');
        return;
      }

      const response = await fetch(`${middleware_url}/batch_process/hls_platform/view_veeva_files?domain=${domain}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ veeva_file_id: (asset as any).document_id }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Failed to fetch file');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('View action cancelled by user');
      } else {
        console.error('Error viewing asset:', err);
      }
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[asset.id];
        return next;
      });
      setAbortControllers(prev => {
        const next = { ...prev };
        delete next[asset.id];
        return next;
      });
    }
  };

  const handleDownloadAsset = async (asset: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const controller = new AbortController();
      setAbortControllers(prev => ({ ...prev, [asset.id]: controller }));
      setActionLoading(prev => ({ ...prev, [asset.id]: 'download' }));
      
      const response = await fetch(`${middleware_url}/batch_process/hls_platform/view_veeva_files?domain=${domain}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ veeva_file_id: (asset as any).document_id }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Failed to fetch file for download');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (asset as any).filename || asset.title || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Download action cancelled by user');
      } else {
        console.error('Error downloading asset:', err);
      }
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[asset.id];
        return next;
      });
      setAbortControllers(prev => {
        const next = { ...prev };
        delete next[asset.id];
        return next;
      });
    }
  };

  const toggleBrandFilter = (brand: string) => {
    setSelectedBrandFilters(prev =>
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );
    setAssetPage(1);
  };

  const toggleAssetTypeFilter = (type: string) => {
    setSelectedAssetTypeFilters(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
    setAssetPage(1);
  };

  const toggleMarketFilter = (market: string) => {
    setSelectedMarketFilters(prev =>
      prev.includes(market) ? prev.filter(m => m !== market) : [...prev, market]
    );
    setAssetPage(1);
  };

  const clearAllFilters = () => {
    setSelectedBrandFilters([]);
    setSelectedAssetTypeFilters([]);
    setSelectedMarketFilters([]);
    setAssetPage(1);
  };

  const handleAssetSelect = (asset: Document) => {
    toggleAssetSelection(asset);
  };

  const handleOpenModal = () => {
    setShowAssetModal(true);
  };

  const handleCloseModal = () => {
    setShowAssetModal(false);
    setAssetSearchQuery('');
    setSelectedBrandFilters([]);
    setSelectedAssetTypeFilters([]);
    setSelectedMarketFilters([]);
    setAssetPage(1);
  };

  // Helper function to apply filters to documents
  const applyFilters = (documents: any[]) => {
    let filtered = [...documents];

    // Apply search filter
    if (assetSearchQuery.trim()) {
      const query = assetSearchQuery.toLowerCase();
      filtered = filtered.filter((doc: any) => {
        return (
          doc.title.toLowerCase().includes(query) ||
          doc.brand.name.toLowerCase().includes(query) ||
          doc.assetType.toLowerCase().includes(query) ||
          doc.market.country.toLowerCase().includes(query)
        );
      });
    }

    // Apply brand filters
    if (selectedBrandFilters.length > 0) {
      filtered = filtered.filter((doc: any) =>
        selectedBrandFilters.includes(doc.brand.name)
      );
    }

    // Apply asset type filters
    if (selectedAssetTypeFilters.length > 0) {
      filtered = filtered.filter((doc: any) =>
        selectedAssetTypeFilters.includes(doc.assetType)
      );
    }

    // Apply market filters
    if (selectedMarketFilters.length > 0) {
      filtered = filtered.filter((doc: any) =>
        selectedMarketFilters.includes(doc.market.country)
      );
    }

    return filtered;
  };

  // Get all mapped documents
  const getAllMappedDocuments = useMemo(() => {
    const combinedDocuments = [...localUploads, ...veevaDocuments];

    // Deduplicate by ID just in case an uploaded document eventually comes back from the API
    const uniqueDocs = [];
    const seenIds = new Set();
    for (const doc of combinedDocuments) {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id);
        uniqueDocs.push(doc);
      }
    }

    return uniqueDocs.map((file: any) => {
      const logoUrl = file.brand_logo
        ? `${middleware_url}/batch_process/hls_platform/brand_logo/${file.brand_logo}`
        : '';
      return {
        id: file.id,
        document_id: file.document_id,
        filename: file.filename,
        version_id: file.version_id,
        title: file.filename,
        brand: {
          name: file.brand_name || 'Unknown Brand',
          logo: logoUrl,
        },
        assetType: file.asset_type || 'General Document',
        web_url: file.web_url,
        market: {
          flag: '🇺🇸',
          country: file.market_name || 'Not Specified',
        }
      };
    });
  }, [veevaDocuments, localUploads]);

  // Get assets based on tab — tabs are display-only labels, all show full filtered list
  const getTabAssets = () => {
    return applyFilters(getAllMappedDocuments);
  };

  // Get unique brands from mapped documents
  const uniqueBrands = useMemo(() => {
    const brands = new Set(getAllMappedDocuments.map((doc: any) => doc.brand.name));
    return Array.from(brands).sort() as string[];
  }, [getAllMappedDocuments]);

  // Get unique markets from mapped documents
  const uniqueMarkets = useMemo(() => {
    const markets = new Set(getAllMappedDocuments.map((doc: any) => doc.market.country));
    return Array.from(markets).sort() as string[];
  }, [getAllMappedDocuments]);

  // Get unique asset categories from mapped documents
  const uniqueAssetCategories = useMemo(() => {
    const types = new Set(getAllMappedDocuments.map((doc: any) => doc.assetType));
    return Array.from(types).sort() as string[];
  }, [getAllMappedDocuments]);

  useEffect(() => {
    // Reset page to 1 when tab changes
    setAssetPage(1);
  }, [getAllMappedDocuments]);

  const tabAssets = useMemo(() => {
    const filtered = getTabAssets();

    // Ensure selected assets are always included and appear at the top
    const selectedIds = new Set(selectedAssets.map(a => a.id));
    const unselectedFiltered = filtered.filter((a: any) => !selectedIds.has(a.id));

    // Explicitly sort to ensure 'Local Upload' is ALWAYS at the very top of unselected results
    unselectedFiltered.sort((a, b) => {
      if (a.assetType === 'Local Upload' && b.assetType !== 'Local Upload') return -1;
      if (a.assetType !== 'Local Upload' && b.assetType === 'Local Upload') return 1;
      return 0;
    });

    return [...selectedAssets, ...unselectedFiltered];
  }, [assetModalTab, veevaDocuments, localUploads, assetSearchQuery, selectedBrandFilters, selectedAssetTypeFilters, selectedMarketFilters, selectedAssets]);

  const paginatedAssets = useMemo(() => {
    const startIndex = (assetPage - 1) * assetsPerPage;
    const endIndex = startIndex + assetsPerPage;
    return tabAssets.slice(startIndex, endIndex);
  }, [assetPage, tabAssets]);

  const totalPages = Math.ceil(tabAssets.length / assetsPerPage);

  // Initialize or re-balance weights when selected assets change or weightages are enabled
  useEffect(() => {
    if (weightagesEnabled && onAssetWeightsChange && selectedAssets.length > 0) {
      // Check if current weights sum to 100 and have all selected assets
      const currentSum = selectedAssets.reduce((sum, a) => sum + (assetWeights?.[a.id] || 0), 0);
      const hasAllKeys = selectedAssets.every(a => assetWeights?.[a.id] !== undefined);

      if (currentSum !== 100 || !hasAllKeys) {
        // Initialize with even split
        const newWeights: Record<string, number> = {};
        const evenSplit = Math.floor(100 / selectedAssets.length);
        selectedAssets.forEach(a => newWeights[a.id] = evenSplit);
        newWeights[selectedAssets[0].id] += 100 - (evenSplit * selectedAssets.length);
        onAssetWeightsChange(newWeights);
        setTouchedWeights([]);
      }
    }
  }, [weightagesEnabled, selectedAssets, onAssetWeightsChange]); // assetWeights is intentionally omitted to avoid infinite loop

  const handleWeightChange = (changedId: string, newValue: number) => {
    if (!assetWeights || !onAssetWeightsChange) return;

    // Clamp new value to its allowed max
    const maxVal = getAssetMax(changedId);
    const clampedValue = Math.min(newValue, maxVal);

    const otherAssets = selectedAssets.filter(a => a.id !== changedId);
    if (otherAssets.length === 0) {
      onAssetWeightsChange({ ...assetWeights, [changedId]: 100 });
      return;
    }

    const newWeights = { ...assetWeights };
    newWeights[changedId] = clampedValue;

    let remainingToDistribute = 100 - clampedValue;

    // Update touched history
    const newTouched = touchedWeights.filter(x => x !== changedId).concat(changedId);
    setTouchedWeights(newTouched);

    const touchedOther = newTouched.filter(x => x !== changedId);
    const untouched = otherAssets.filter(a => !newTouched.includes(a.id));

    let touchedSum = 0;
    touchedOther.forEach(tid => {
      touchedSum += assetWeights[tid] || 0;
    });

    if (touchedSum <= remainingToDistribute) {
      remainingToDistribute -= touchedSum;
      if (untouched.length > 0) {
        const untouchedCurrentSum = untouched.reduce((sum, a) => sum + (assetWeights[a.id] || 0), 0);
        untouched.forEach((a, i) => {
          if (i === untouched.length - 1) {
            newWeights[a.id] = remainingToDistribute;
          } else {
            const share = untouchedCurrentSum === 0
              ? Math.floor(remainingToDistribute / untouched.length)
              : Math.round(remainingToDistribute * ((assetWeights[a.id] || 0) / untouchedCurrentSum));
            newWeights[a.id] = share;
            remainingToDistribute -= share;
          }
        });
      } else {
        if (touchedOther.length > 0) {
          newWeights[touchedOther[0]] += remainingToDistribute;
        }
      }
    } else {
      untouched.forEach(a => newWeights[a.id] = 0);
      for (let i = 0; i < touchedOther.length; i++) {
        const tid = touchedOther[i];
        const current = assetWeights[tid] || 0;
        if (remainingToDistribute >= current) {
          newWeights[tid] = current;
          remainingToDistribute -= current;
        } else {
          newWeights[tid] = remainingToDistribute;
          remainingToDistribute = 0;
        }
      }
    }

    onAssetWeightsChange(newWeights);
  };

  const getAssetMax = (assetId: string) => {
    const touchedOther = touchedWeights.filter(x => x !== assetId);
    const sum = touchedOther.reduce((acc, tid) => acc + (assetWeights[tid] || 0), 0);
    return 100 - sum;
  };

  const currentSum = selectedAssets.reduce((sum, a) => sum + (assetWeights?.[a.id] || 0), 0);

  return (
    <>
      {/* Column 1 Sidebar - Hidden in Standalone Mode */}
      {!isStandalone && (
        <div className="flex flex-col h-full overflow-hidden px-4 py-1 opacity-95">
          <div className="mb-2 flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <FileUp className="text-[#53A2FF] size-8 shrink-0 relative -top-[20px]" />

              <div className="flex flex-col justify-center">
                <b className="text-slate-800 text-xl leading-none">Select Asset</b>

                <p className="mt-2 text-[10px] uppercase tracking-wide text-[var(--hls-muted)] leading-none">Choose an approved promotional asset from Veeva</p>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div
              onClick={handleOpenModal}
              className="w-full h-10 mb-2px-4 flex items-center justify-between bg-[#53A2FF] hover:bg-[#3d8beb] text-white shadow-md transition-all flex-shrink-0 rounded-md cursor-pointer"
            >
              <div className="flex items-center gap-2 font-medium">
                {selectedAssets.length > 0 ? (
                  <>
                    <span>Asset{selectedAssets.length > 1 ? 's' : ''} Selected</span>
                    <span className="bg-black text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                      {selectedAssets.length}
                    </span>
                  </>
                ) : (
                  <span>Select Assets</span>
                )}
              </div>
              <Sparkles className="size-4" />
            </div>

            <ScrollArea className="flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 overflow-hidden">
              <div className="space-y-2 pr-4 pb-4">
                {selectedAssets.map((asset) => (
                  <Card key={asset.id} className="p-3 border-1 border-[#53A2FF] bg-[#e6f5ff]/50 relative">
                    <div className="absolute top-1 right-1 flex gap-1">
                      <div
                        onClick={(e) => { e.stopPropagation(); if(actionLoading[asset.id] === 'view') { handleCancelAction(asset.id); } else if (!actionLoading[asset.id]) { handleViewAsset(asset); } }}
                        className={`size-5 p-0 flex items-center justify-center rounded transition-colors group ${actionLoading[asset.id] === 'view' ? 'hover:bg-red-100 cursor-pointer' : actionLoading[asset.id] ? 'cursor-not-allowed opacity-50' : 'hover:bg-blue-100 cursor-pointer'}`}
                        title={actionLoading[asset.id] === 'view' ? "Cancel view" : "View asset"}
                      >
                        {actionLoading[asset.id] === 'view' ? (
                          <>
                            <Loader2 className="size-4 text-[#53A2FF] animate-spin group-hover:hidden" />
                            <X className="size-4 text-red-500 hidden group-hover:block" />
                          </>
                        ) : <Eye className="size-4 text-[#53A2FF]" />}
                      </div>
                      <div
                        onClick={(e) => { e.stopPropagation(); if(actionLoading[asset.id] === 'download') { handleCancelAction(asset.id); } else if (!actionLoading[asset.id]) { handleDownloadAsset(asset, e); } }}
                        className={`size-5 p-0 flex items-center justify-center rounded transition-colors group ${actionLoading[asset.id] === 'download' ? 'hover:bg-red-100 cursor-pointer' : actionLoading[asset.id] ? 'cursor-not-allowed opacity-50' : 'hover:bg-blue-100 cursor-pointer'}`}
                        title={actionLoading[asset.id] === 'download' ? "Cancel download" : "Download asset"}
                      >
                        {actionLoading[asset.id] === 'download' ? (
                          <>
                            <Loader2 className="size-4 text-[#53A2FF] animate-spin group-hover:hidden" />
                            <X className="size-4 text-red-500 hidden group-hover:block" />
                          </>
                        ) : <Download className="size-4 text-[#53A2FF]" />}
                      </div>
                      <div
                        onClick={() => removeAsset(asset.id)}
                        className="size-5 p-0 hover:bg-red-100 flex items-center justify-center cursor-pointer rounded transition-colors"
                        title="Remove asset"
                      >
                        <X className="size-4 text-red-500" />
                      </div>
                    </div>
                    <div className="flex items-start gap-2 mb-2 pr-10">
                      <img src={asset.brand.logo || doclogo} alt={asset.brand.name} className="size-6 object-contain flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-800 text-xs font-medium truncate">{asset.brand.name}</div>
                        <p className="text-slate-500 text-xs flex items-center gap-1">
                          <span>{asset.market.country}</span>
                        </p>
                      </div>
                    </div>
                    <p className="text-slate-700 text-xs line-clamp-0.5 truncate mb-2" title={asset.title}>{formatFileName(asset.title)}</p>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-xs">{asset.assetType}</Badge>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Asset Selection UI - Modal or Inline */}
      {(showAssetModal || isStandalone) && (
        <div
          className={isStandalone ? "w-full h-full flex flex-col" : "fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-auto"}
          onClick={!isStandalone ? handleCloseModal : undefined}
        >
          <div className={isStandalone ? "w-full h-full" : "w-full max-w-6xl mt-2"}>
            <Card
              className={`bg-white flex flex-col relative ${isStandalone ? 'border-none shadow-none rounded-none' : 'rounded-lg'}`}
              style={{ height: isStandalone ?  '100%' : '80vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Close Button */}
              {!isStandalone && (
                <div className="absolute top-6 right-6 z-10">
                  <div
                    onClick={handleCloseModal}
                    className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 p-2 rounded cursor-pointer transition-colors flex items-center justify-center"
                  >
                    <X className="size-5" />
                  </div>
                </div>
              )}

              {/* Tabs */}
              {domain !== 'sales' && (
                <div className="px-6 pt-4 pb-2 flex-shrink-0 border-b border-[#cceaff]">
                  <div className="flex gap-2 overflow-x-auto">
                    <div
                      onClick={() => { setAssetModalTab('favorites'); setAssetPage(1); }}
                      className={`px-4 py-2 rounded-full flex items-center cursor-pointer transition-colors ${assetModalTab === 'favorites'
                        ? 'bg-[#53A2FF] text-white shadow-md'
                        : 'bg-white border-1 border-[#b3e0ff] text-[#53A2FF] hover:bg-[#e6f5ff]'
                        }`}
                    >
                      <Star className="size-3 mr-1.5" />
                      Your Favorites (16)
                    </div>
                    <div
                      onClick={() => { setAssetModalTab('recent'); setAssetPage(1); }}
                      className={`px-4 py-2 rounded-full flex items-center cursor-pointer transition-colors ${assetModalTab === 'recent'
                        ? 'bg-[#53A2FF] text-white shadow-md'
                        : 'bg-white border-1 border-[#b3e0ff] text-[#53A2FF] hover:bg-[#e6f5ff]'
                        }`}
                    >
                      <Clock className="size-3 mr-1.5" />
                      Recently Accessed (12)
                    </div>
                    <div
                      onClick={() => { setAssetModalTab('frequent'); setAssetPage(1); }}
                      className={`px-4 py-2 rounded-full flex items-center cursor-pointer transition-colors ${assetModalTab === 'frequent'
                        ? 'bg-[#53A2FF] text-white shadow-md'
                        : 'bg-white border-1 border-[#b3e0ff] text-[#53A2FF] hover:bg-[#e6f5ff]'
                        }`}
                    >
                      <TrendingUp className="size-3 mr-1.5" />
                      Frequently Accessed (10)
                    </div>
                    <div
                      onClick={() => { setAssetModalTab('recommended'); setAssetPage(1); }}
                      className={`px-4 py-2 rounded-full flex items-center cursor-pointer transition-colors ${assetModalTab === 'recommended'
                        ? 'bg-[#53A2FF] text-white shadow-md'
                        : 'bg-white border-1 border-[#b3e0ff] text-[#53A2FF] hover:bg-[#e6f5ff]'
                        }`}
                    >
                      <Lightbulb className="size-3 mr-1.5" />
                      Recommended (8)
                    </div>
                  </div>
                </div>
              )}

              {/* Search Bar */}
              {domain === 'sales' ? (
                <div className="px-6 py-4 flex flex-col items-center justify-center flex-shrink-0 border-b bg-gradient-to-b from-slate-50 to-white" style={{ borderColor: '#cceaff' }}>
                  <div className="flex items-center gap-4 w-full max-w-3xl">
                    <div className="flex items-center gap-3 h-14 flex-1 bg-white border-2 rounded-full px-6 shadow-sm transition-all focus-within:shadow-md border-[#b3e0ff] focus-within:border-[#53A2FF]">
                      <Sparkles className="size-5 flex-shrink-0 animate-pulse text-[#53A2FF]" />
                      <div className="w-px h-8 bg-[#b3e0ff]"></div>
                      <Input
                        type="text"
                        placeholder="Search ZenVault..."
                        value={assetSearchQuery}
                        onChange={(e) => {
                          setAssetSearchQuery(e.target.value);
                          setAssetPage(1);
                        }}
                        className="flex-1 border-0 bg-transparent px-2 text-lg focus-visible:ring-0 focus-visible:ring-offset-0 h-auto p-0"
                      />
                      <div
                        onClick={() => setRefreshKey(prev => prev + 1)}
                        className={`size-8 flex items-center justify-center rounded-full hover:bg-[#e6f5ff] cursor-pointer transition-colors text-[#53A2FF] ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                        title="Search again"
                      >
                        <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                      </div>
                    </div>
                    <div className="h-14">
                      <input
                        type="file"
                        id="modal-local-file-upload"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.txt,.pptx,.xlsx"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          const formData = new FormData();
                          formData.append('file', file);
                          formData.append('doc_name', file.name);

                          try {
                            const response = await fetch(`${middleware_url}/batch_process/hls_platform/local_documents?domain=${domain}`, {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                              body: formData
                            });
                            const data = await response.json();
                            if (data.success && data.document) {
                              const newAsset = {
                                id: data.document.id,
                                document_id: data.document.document_unique_id,
                                filename: data.document.filename,
                                version_id: null,
                                title: data.document.name,
                                brand: { name: file.name, logo: '' },
                                assetType: 'Local Upload',
                                market: { flag: '', country: 'Local' }
                              };

                              const rawVeevaFormat = {
                                id: data.document.id,
                                document_id: data.document.document_unique_id,
                                filename: data.document.filename,
                                version_id: null,
                                brand_name: file.name,
                                asset_type: 'Local Upload',
                                market_name: 'Local',
                                status: 'Approved',
                                domain: domain
                              };

                              setLocalUploads(prev => [rawVeevaFormat, ...prev]);
                              onAssetsChange([...selectedAssets, newAsset]);
                            } else {
                              alert(`Upload failed: ${data.error}`);
                            }
                          } catch (err) {
                            alert('Upload failed');
                          }
                        }}
                      />
                      <label htmlFor="modal-local-file-upload" className="inline-block h-14 px-8 leading-[52px] text-center bg-white text-[#53A2FF] border-2 border-[#53A2FF] hover:bg-[#e6f5ff] shadow-sm transition-all rounded-full cursor-pointer font-bold text-base whitespace-nowrap align-top">
                        Upload File
                      </label>
                    </div>
                    {isStandalone && onConvertClick && (() => {
                      const isOverBudget = usageData ? usageData.today_cost >= usageData.daily_cost_limit : false;
                      const isConvertDisabled = selectedAssets.length === 0 || isOverBudget;

                      return (
                        <div
                          onClick={!isConvertDisabled ? onConvertClick : undefined}
                          style={!isConvertDisabled ? { background: 'linear-gradient(90deg, #8ab4f8, #f28b82, #fdd663, #81c995)' } : {}}
                          className={`inline-flex h-14 px-8 leading-[52px] items-center justify-center gap-2 text-center rounded-full font-bold text-base whitespace-nowrap transition-all shadow-sm ${!isConvertDisabled
                            ? 'text-slate-800 hover:opacity-90 hover:shadow-md cursor-pointer border-2 border-slate-800'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed border-2 border-transparent'
                            }`}
                          title={isOverBudget ? "Daily usage limit reached" : ""}
                        >
                          <span>{isOverBudget ? "Limit Reached" : "Convert Content"}</span>
                          <Sparkles className="size-4" />
                        </div>
                      );
                    })()}
                  </div>
                  <p className="text-slate-500 text-sm mt-3">Searching across all documents, slides, and contents instantly.</p>
                  {/* Weightage Toggle Moved Here */}
                  {weightagesEnabled !== undefined && selectedAssets.length > 0 && (
                    <div className="flex items-center justify-center gap-6 mt-4">
                      <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 shadow-sm">
                        <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <TrendingUp className="size-4 text-[#53A2FF]" /> Enable Custom Weightage
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={weightagesEnabled} onChange={(e) => onWeightagesEnabledChange?.(e.target.checked)} />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#53A2FF]"></div>
                        </label>
                      </div>
                      {weightagesEnabled && (
                        <div className={`px-4 py-2 rounded-lg text-sm font-bold border shadow-sm ${currentSum === 100 ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                          Total Weight: {currentSum}% {currentSum !== 100 && '(Must equal 100%)'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-6 py-2 flex-shrink-0 border-b border-[#cceaff]">
                  <div className="flex items-center gap-3 h-10 bg-[#e6f5ff]/30 border border-[#b3e0ff] rounded-md px-3 focus-within:border-[#53A2FF] focus-within:ring-1 focus-within:ring-[#53A2FF] transition-all">
                    <Search className="size-4 text-[#81c5ff] flex-shrink-0" />
                    <div className="w-px h-6 bg-[#b3e0ff]"></div>
                    <Input
                      type="text"
                      placeholder="Search by title, brand ..."
                      value={assetSearchQuery}
                      onChange={(e) => {
                        setAssetSearchQuery(e.target.value);
                        setAssetPage(1);
                      }}
                      className="flex-1 border-0 bg-transparent px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 h-auto p-0"
                    />
                  </div>
                </div>
              )}

              {/* Main Content Area with Sidebar */}
              <div className="flex-1 overflow-hidden flex">
                {/* Left Sidebar - Filters */}
                {domain !== 'sales' && (
                  <div className="w-64 bg-[#f8fbfe] border-r border-[#cceaff] flex-shrink-0">
                    <ScrollArea className="h-full px-4 py-3 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-slate-700 font-semibold text-sm">Filters</div>
                        <div
                          onClick={clearAllFilters}
                          className="text-[#53A2FF] hover:text-[#3d8beb] text-xs font-medium h-auto p-0 cursor-pointer"
                        >
                          Clear All
                        </div>
                      </div>

                      {/* Market Filter */}
                      <div className="mb-4">
                        <div className="text-slate-800 text-sm font-semibold mb-2">Market</div>
                        <div className="space-y-2">
                          {uniqueMarkets.map((market: string) => (
                            <div key={market} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`market-${market}`}
                                checked={selectedMarketFilters.includes(market)}
                                onChange={() => toggleMarketFilter(market)}
                                className="w-4 h-4 border-[#99d2ff] rounded cursor-pointer"
                              />
                              <label htmlFor={`market-${market}`} className="ml-3 text-slate-700 text-sm cursor-pointer font-normal">
                                {market}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Brand Filter */}
                      <div className="mb-4">
                        <div className="text-slate-800 text-sm font-semibold mb-2">Brand</div>
                        <div className="space-y-2">
                          {uniqueBrands.map((brand: string) => (
                            <div key={brand} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`brand-${brand}`}
                                checked={selectedBrandFilters.includes(brand)}
                                onChange={() => toggleBrandFilter(brand)}
                                className="w-4 h-4 border-[#99d2ff] rounded cursor-pointer"
                              />
                              <label htmlFor={`brand-${brand}`} className="ml-3 text-slate-700 text-sm cursor-pointer font-normal">
                                {brand}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Asset Categories Filter */}
                      <div>
                        <div className="text-slate-800 text-sm font-semibold mb-2">Asset Categories</div>
                        <div className="space-y-2">
                          {uniqueAssetCategories.map((type: string) => (
                            <div key={type} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`type-${type}`}
                                checked={selectedAssetTypeFilters.includes(type)}
                                onChange={() => toggleAssetTypeFilter(type)}
                                className="w-4 h-4 border-[#99d2ff] rounded cursor-pointer"
                              />
                              <label htmlFor={`type-${type}`} className="ml-3 text-slate-700 text-sm cursor-pointer font-normal">
                                {type}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Right Content - Asset Grid */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                    {loading && (
                      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                        <svg className="animate-spin size-10 text-[#53A2FF]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                        </svg>
                        <p className="text-slate-500 text-sm">Loading documents...</p>
                      </div>
                    )}
                    {error && (
                      <div className="flex items-center justify-center min-h-[400px]">
                        <p className="text-red-600">Error: {error}</p>
                      </div>
                    )}
                    {!loading && !error && tabAssets.length === 0 && (
                      <div className="flex flex-col items-center justify-start pt-32 min-h-[400px]">
                        <p className="text-slate-400 text-2xl font-light tracking-wide">
                          {veevaDocuments.length === 0
                            ? "Start a search..."
                            : "No documents match your search or filter criteria"}
                        </p>
                      </div>
                    )}
                    {!loading && !error && tabAssets.length > 0 && (
                      <div className="grid grid-cols-3 gap-4 pb-4">
                        {paginatedAssets.map((asset) => {
                          const isSelected = selectedAssets.some(a => a.id === asset.id);
                          return (
                            <Card
                              key={asset.id}
                              onClick={() => handleAssetSelect(asset)}
                              className={`p-3 cursor-pointer transition-all hover:shadow-md border hover:border-[#99d2ff] relative ${isSelected ? 'border-[#53A2FF] bg-[#e6f5ff]/50 border-2' : 'border-2 border-[#cceaff]'
                                }`}
                            >
                              {isSelected && (
                                <div className="absolute top-2 left-2">
                                  <CheckCircle2 className="size-5 text-[#53A2FF]" />
                                </div>
                              )}
                              <div
                                onClick={(e) => { e.stopPropagation(); if(actionLoading[asset.id] === 'view') { handleCancelAction(asset.id); } else if (!actionLoading[asset.id]) { handleViewAsset(asset); } }}
                                className={`absolute top-2 ${isSelected ? 'left-8' : 'left-2'} size-6 p-0 flex items-center justify-center rounded-full transition-colors z-10 group ${actionLoading[asset.id] === 'view' ? 'bg-red-50 hover:bg-red-100 cursor-pointer' : actionLoading[asset.id] ? 'bg-slate-100 cursor-not-allowed opacity-50' : 'hover:bg-slate-200 cursor-pointer'}`}
                                title={actionLoading[asset.id] === 'view' ? "Cancel preview" : "Preview asset"}
                              >
                                {actionLoading[asset.id] === 'view' ? (
                                  <>
                                    <Loader2 className="size-4 text-slate-500 animate-spin group-hover:hidden" />
                                    <X className="size-4 text-red-500 hidden group-hover:block" />
                                  </>
                                ) : <Eye className="size-4 text-slate-900 hover:text-black" />}
                              </div>
                              <div
                                onClick={(e) => { e.stopPropagation(); if(actionLoading[asset.id] === 'download') { handleCancelAction(asset.id); } else if (!actionLoading[asset.id]) { handleDownloadAsset(asset, e); } }}
                                className={`absolute top-2 right-2 size-6 p-0 flex items-center justify-center rounded-full transition-colors z-10 group ${actionLoading[asset.id] === 'download' ? 'bg-red-50 hover:bg-red-100 cursor-pointer' : actionLoading[asset.id] ? 'bg-slate-100 cursor-not-allowed opacity-50' : 'hover:bg-slate-200 cursor-pointer'}`}
                                title={actionLoading[asset.id] === 'download' ? "Cancel download" : "Download asset"}
                              >
                                {actionLoading[asset.id] === 'download' ? (
                                  <>
                                    <Loader2 className="size-4 text-slate-500 animate-spin group-hover:hidden" />
                                    <X className="size-4 text-red-500 hidden group-hover:block" />
                                  </>
                                ) : <Download className="size-4 text-slate-900 hover:text-black" />}
                              </div>
                              <div className="flex flex-col items-center mb-2">
                                <img src={asset.brand.logo || doclogo} alt={asset.brand.name} className="size-12 object-contain mb-2" />
                                <div className="text-slate-800 text-sm font-medium text-center mb-1 line-clamp-2 w-full break-words break-all px-1" title={asset.title}>{formatFileName(asset.title)}</div>
                                <p className="text-slate-500 text-xs flex items-center gap-1 mb-2">
                                  {/* <span>{asset.market.flag}</span> */}
                                  <span>{asset.market.country}</span>
                                </p>
                              </div>

                              <Badge variant="secondary" className="bg-[#cceaff] text-[#53A2FF] text-xs w-full justify-center truncate">
                                {asset.assetType}
                              </Badge>
                              {isSelected && weightagesEnabled && (
                                <div className="mt-3 flex items-center gap-2 pt-3 border-t border-[#b3e0ff]" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-xs text-slate-600 font-medium whitespace-nowrap">Weight:</span>
                                  <input type="range" min="0" max={getAssetMax(asset.id)} value={assetWeights?.[asset.id] || 0} onChange={(e) => handleWeightChange(asset.id, parseInt(e.target.value))} className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer min-w-0" />
                                  <div className="flex items-center gap-0.5 w-16 shrink-0 bg-white border border-gray-300 rounded px-1.5 shadow-inner h-7">
                                    <input type="number" min="0" max={getAssetMax(asset.id)} value={assetWeights?.[asset.id] || 0} onChange={(e) => handleWeightChange(asset.id, parseInt(e.target.value) || 0)} className="w-full text-xs text-[#53A2FF] font-bold text-right border-none bg-transparent p-0 focus:ring-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    <span className="text-xs text-[#53A2FF] font-bold">%</span>
                                  </div>
                                </div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Pagination */}
                  <div className="px-6 py-3 border-t border-[#cceaff] flex items-center justify-end">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <span>{assetPage} out of {totalPages}</span>
                      <button
                        onClick={() => setAssetPage(prev => Math.max(1, prev - 1))}
                        disabled={assetPage === 1}
                        className="text-[#53A2FF] hover:text-[#3d8beb] disabled:opacity-50"
                      >
                        &lt; Prev
                      </button>
                      <button
                        onClick={() => setAssetPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={assetPage === totalPages}
                        className="text-[#53A2FF] hover:text-[#3d8beb] disabled:opacity-50"
                      >
                        Next &gt;
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Limit Warning Dialog */}
      <Dialog open={showLimitWarning} onOpenChange={setShowLimitWarning}>
        <DialogContent className="sm:max-w-md bg-white border-red-100 shadow-xl z-[60]">
          <DialogHeader>
            <DialogTitle className="text-slate-800 flex items-center gap-2">
              <AlertCircle className="size-5 text-red-500" />
              Maximum Limit Reached
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-slate-600">
            You can only select up to 3 assets for conversion. Please unselect an existing asset before adding a new one.
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                Got it
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
