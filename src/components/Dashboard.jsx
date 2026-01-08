import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
import SnapshotTable from './SnapshotTable';

const Dashboard = () => {
    const [symbol, setSymbol] = useState('NIFTY');
    const [currentData, setCurrentData] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const [refreshInterval] = useState(5000); // 5 seconds
    const [timeLeft, setTimeLeft] = useState(5); // Countdown timer
    const [previousData, setPreviousData] = useState(null); // Store previous fetch for comparison
    const [strikeCount, setStrikeCount] = useState(5); // Default 5 strikes
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - (offset * 60 * 1000));
        return local.toISOString().split('T')[0];
    }); // Default: Today (Local)
    const [timeFilter, setTimeFilter] = useState('all'); // Default: All Time
    const [currentTime, setCurrentTime] = useState(new Date()); // Clock state
    const [showClock, setShowClock] = useState(true); // Toggle clock


    const fetchData = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            // 1. Fetch only latest first to check for changes
            const latestRes = await axios.get(`${API_BASE_URL}/api/latest?symbol=${symbol}`);
            const latest = latestRes.data;

            if (!latest) {
                if (!isBackground) setLoading(false);
                return;
            }

            // Check if data has changed (compare with current loaded data)
            // We use _id comparison if available, or timestamp
            const isNewData = !previousData ||
                (latest._id && previousData._id !== latest._id) ||
                (latest.timestamp !== previousData.timestamp);

            if (isNewData) {
                console.log('Data updated - changes detected. Fetching full history...');

                // 2. Only fetch full history if we have new data
                const histRes = await axios.get(`${API_BASE_URL}/api/history?symbol=${symbol}&limit=all`);

                if (histRes.data.length > 0) {
                    setHistory(histRes.data);
                    setCurrentData(latest);
                    setLastUpdated(new Date(latest.timestamp).toLocaleTimeString());
                    setPreviousData(latest);
                }
            } else {
                console.log('No changes detected - skipping update');
            }
        } catch (error) {
            console.error('Error fetching data', error);
        }
        if (!isBackground) setLoading(false);
    };

    // Initial fetch on mount or symbol change
    useEffect(() => {
        fetchData(false);
    }, [symbol]);

    // Poll every 5 seconds
    // Countdown and Auto-Refresh Effect
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    fetchData(true);
                    return 5; // Reset to 5 seconds
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [symbol, previousData]);

    // Clock Effect
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Derived values
    const totalCE = currentData?.data?.filtered?.CE?.totOI || 0;
    const totalPE = currentData?.data?.filtered?.PE?.totOI || 0;
    const pcr = (totalPE / (totalCE || 1)).toFixed(2);
    const spotPrice = currentData?.data?.records?.underlyingValue || 'N/A';

    // Generate last 7 days for dropdown
    const availableDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    });

    return (
        <div className="p-6 max-w-7xl mx-auto relative">
            {/* Floating Time Display */}
            {showClock && (
                <div className="fixed top-4 left-4 bg-black/80 text-white px-3 py-1 rounded shadow-lg z-50 text-sm font-mono tracking-wider border border-gray-600">
                    {currentTime.toLocaleTimeString()}
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">OI Dashboard</h1>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <span className="text-xs md:text-sm text-gray-500 flex flex-col items-start md:items-end order-3 md:order-1 w-full md:w-auto">
                        <span>Updated: {lastUpdated || 'Never'}</span>
                        {currentData?.data?.nseTimestamp && (
                            <span className="text-xs text-blue-600 font-semibold">NSE: {currentData.data.nseTimestamp}</span>
                        )}
                    </span>

                    <label className="flex items-center gap-2 text-xs md:text-sm text-gray-600 cursor-pointer select-none bg-white px-2 md:px-3 py-2 rounded border shadow-sm hover:bg-gray-50 order-2">
                        <input
                            type="checkbox"
                            checked={showClock}
                            onChange={(e) => setShowClock(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        Clock
                    </label>

                    <select
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        className="p-2 border rounded shadow-sm bg-white text-sm md:text-base flex-1 md:flex-none order-1"
                    >
                        <option value="NIFTY">NIFTY 50</option>
                        <option value="BANKNIFTY">BANKNIFTY</option>
                        <option value="FINNIFTY">FINNIFTY</option>
                    </select>
                    <button
                        onClick={() => { fetchData(); setTimeLeft(5); }}
                        disabled={loading}
                        className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 min-w-[80px] md:min-w-[100px] text-sm md:text-base order-4 md:order-last"
                    >
                        {loading ? '...' : `Refresh (${timeLeft}s)`}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                <div className="bg-white p-3 md:p-4 rounded shadow border-l-4 border-blue-500">
                    <h3 className="text-gray-500 text-xs md:text-sm">Spot Price</h3>
                    <p className="text-xl md:text-2xl font-bold">{spotPrice}</p>
                </div>
                <div className="bg-white p-3 md:p-4 rounded shadow border-l-4 border-green-500">
                    <h3 className="text-gray-500 text-xs md:text-sm">PCR</h3>
                    <p className="text-xl md:text-2xl font-bold">{pcr}</p>
                </div>
                <div className="bg-white p-3 md:p-4 rounded shadow border-l-4 border-red-500">
                    <h3 className="text-gray-500 text-xs md:text-sm">Total CE OI</h3>
                    <p className="text-xl md:text-2xl font-bold text-red-600">{totalCE.toLocaleString()}</p>
                </div>
                <div className="bg-white p-3 md:p-4 rounded shadow border-l-4 border-teal-500">
                    <h3 className="text-gray-500 text-xs md:text-sm">Total PE OI</h3>
                    <p className="text-xl md:text-2xl font-bold text-teal-600">{totalPE.toLocaleString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white p-3 md:p-4 rounded shadow overflow-hidden">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 gap-4">
                        <h3 className="font-bold text-lg">Snapshot History</h3>
                        <div className="flex flex-wrap gap-2 md:gap-3 items-center w-full xl:w-auto">
                            <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                                <label className="text-gray-600">Strikes:</label>
                                <select
                                    className="border rounded px-1 md:px-2 py-1 bg-white"
                                    value={strikeCount}
                                    onChange={(e) => setStrikeCount(Number(e.target.value))}
                                >
                                    <option value={3}>3</option>
                                    <option value={5}>5</option>
                                    <option value={7}>7</option>
                                    <option value={9}>9</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                                <label className="text-gray-600">Date:</label>
                                <select
                                    className="border rounded px-1 md:px-2 py-1 bg-white"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                >
                                    {availableDates.map(date => (
                                        <option key={date} value={date}>{date}</option>
                                    ))}
                                    <option value="">All Time</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                                <label className="text-gray-600">Time:</label>
                                <select
                                    className="border rounded px-1 md:px-2 py-1"
                                    value={timeFilter}
                                    onChange={(e) => setTimeFilter(e.target.value)}
                                >
                                    <option value="1h">1 Hour</option>
                                    <option value="3h">3 Hours</option>
                                    <option value="6h">6 Hours</option>
                                    <option value="all">All</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <SnapshotTable historyData={history} selectedDate={selectedDate} timeFilter={timeFilter} strikeCount={strikeCount} />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
