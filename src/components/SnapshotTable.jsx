import React, { useState } from 'react';

const SnapshotTable = ({ historyData, selectedDate, timeFilter, strikeCount }) => {
    // State for column visibility
    const [visibleColumns, setVisibleColumns] = useState({
        oi: true,
        volume: true,
        iv: true,
        ltp: true,
        oiValue: false
    });

    const LOT_SIZE = Number(import.meta.env.VITE_LOT_SIZE) || 65;

    // historyData is sorted oldest to newest from backend
    // User wants Newest at TOP (Reverse Chronological)
    let historyToDisplay = [...historyData].reverse();

    // Date filter - filter by specific date
    if (selectedDate) {
        const selected = new Date(selectedDate);
        selected.setHours(0, 0, 0, 0);
        const nextDay = new Date(selected);
        nextDay.setDate(nextDay.getDate() + 1);

        historyToDisplay = historyToDisplay.filter(snapshot => {
            const snapshotTime = new Date(snapshot.timestamp);
            return snapshotTime >= selected && snapshotTime < nextDay;
        });
    }

    // Time filter (works in combination with date filter)
    if (timeFilter && timeFilter !== 'all') {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        const localNow = new Date(now.getTime() - (offset * 60 * 1000));
        const todayStr = localNow.toISOString().split('T')[0];

        // If selectedDate is set and it is NOT today, ignore time filter
        const isPastDate = selectedDate && selectedDate !== todayStr;

        if (!isPastDate) {
            const hoursMap = { '1h': 1, '3h': 3, '6h': 6 };
            const hours = hoursMap[timeFilter] || 24;
            const cutoffTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));

            historyToDisplay = historyToDisplay.filter(snapshot => {
                const snapshotTime = new Date(snapshot.timestamp);
                return snapshotTime >= cutoffTime;
            });
        }
    }

    const formatNumber = (val) => (val || 0).toLocaleString();

    // Helper to find closest strike
    const findClosestStrike = (price, step = 50) => {
        return Math.round(price / step) * step;
    };

    const downloadExcel = () => {
        const rows = [];
        rows.push([
            'Timestamp',
            'NSE Time',
            'Spot Price',
            'Strike Price',
            'CE OI',
            'CE OI Change',
            'CE OI Value',
            'CE Volume',
            'CE Vol Change',
            'CE IV',
            'CE LTP',
            'PE LTP',
            'PE IV',
            'PE Volume',
            'PE Vol Change',
            'PE OI Value',
            'PE OI',
            'PE OI Change'
        ]);

        historyToDisplay.forEach((snapshot, index) => {
            const timestamp = new Date(snapshot.timestamp).toLocaleString();
            const nseTime = snapshot.data?.nseTimestamp || '';
            const spot = snapshot.data?.records?.underlyingValue || 0;
            const records = snapshot.data?.records?.data || [];
            const atmStrike = findClosestStrike(spot, 50);

            const range = (strikeCount - 1) / 2;
            const strikesToShow = [];
            for (let i = -range; i <= range; i++) {
                strikesToShow.push(atmStrike + (i * 50));
            }

            const prevSnapshot = historyToDisplay[index + 1];

            strikesToShow.forEach(strike => {
                const r = records.find(item => item.strikePrice === strike);
                const prevRecord = prevSnapshot?.data?.records?.data?.find(item => item.strikePrice === strike);

                if (r) {
                    const currCE = r.CE?.openInterest || 0;
                    const prevCE = prevRecord?.CE?.openInterest || 0;
                    let diffCE = 0;
                    if (prevSnapshot) diffCE = currCE - prevCE;
                    else if (r.CE?.diffOpenInterest !== undefined) diffCE = r.CE.diffOpenInterest;

                    const currCEVol = r.CE?.totalTradedVolume || 0;
                    const prevCEVol = prevRecord?.CE?.totalTradedVolume || 0;
                    let diffCEVol = 0;
                    if (prevSnapshot) diffCEVol = currCEVol - prevCEVol;
                    else if (r.CE?.diffTotalTradedVolume !== undefined) diffCEVol = r.CE.diffTotalTradedVolume;

                    const currPE = r.PE?.openInterest || 0;
                    const prevPE = prevRecord?.PE?.openInterest || 0;
                    let diffPE = 0;
                    if (prevSnapshot) diffPE = currPE - prevPE;
                    else if (r.PE?.diffOpenInterest !== undefined) diffPE = r.PE.diffOpenInterest;

                    const currPEVol = r.PE?.totalTradedVolume || 0;
                    const prevPEVol = prevRecord?.PE?.totalTradedVolume || 0;
                    let diffPEVol = 0;
                    if (prevSnapshot) diffPEVol = currPEVol - prevPEVol;
                    else if (r.PE?.diffTotalTradedVolume !== undefined) diffPEVol = r.PE.diffTotalTradedVolume;

                    rows.push([
                        timestamp,
                        nseTime,
                        spot,
                        strike,
                        currCE,
                        diffCE,
                        (currCE * LOT_SIZE / 100000).toFixed(2),
                        currCEVol,
                        diffCEVol,
                        r.CE?.impliedVolatility || 0,
                        r.CE?.lastPrice || 0,
                        r.PE?.lastPrice || 0,
                        r.PE?.impliedVolatility || 0,
                        currPEVol,
                        diffPEVol,
                        (currPE * LOT_SIZE / 100000).toFixed(2),
                        currPE,
                        diffPE
                    ]);
                }
            });
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + rows.map(e => e.join(",")).join("\n");

        const dateStr = selectedDate || new Date().toISOString().slice(0, 10);
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `oi_history_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getGridTemplate = () => {
        let cols = [];
        if (visibleColumns.oi) cols.push('1.2fr');
        if (visibleColumns.oiValue) cols.push('1.2fr');
        if (visibleColumns.volume) cols.push('1fr');
        if (visibleColumns.iv) cols.push('0.8fr');
        if (visibleColumns.ltp) cols.push('0.8fr');
        cols.push('80px'); // Strike
        if (visibleColumns.ltp) cols.push('0.8fr');
        if (visibleColumns.iv) cols.push('0.8fr');
        if (visibleColumns.volume) cols.push('1fr');
        if (visibleColumns.oiValue) cols.push('1.2fr');
        if (visibleColumns.oi) cols.push('1.2fr');
        return cols.join(' ');
    };

    const gridStyle = { gridTemplateColumns: getGridTemplate() };

    let finalHistory = [];
    if (historyToDisplay.length > 0) {
        const chronological = [...historyToDisplay].reverse();
        chronological.forEach((currSnapshot) => {
            if (finalHistory.length === 0) {
                finalHistory.push(currSnapshot);
                return;
            }
            const prevSnapshot = finalHistory[finalHistory.length - 1];
            const spotPrice = currSnapshot.data?.records?.underlyingValue || 0;
            const atmStrike = findClosestStrike(spotPrice, 50);
            const range = (strikeCount - 1) / 2;
            const strikesToCheck = [];
            for (let i = -range; i <= range; i++) {
                strikesToCheck.push(atmStrike + (i * 50));
            }
            let hasOIChange = false;
            for (const strike of strikesToCheck) {
                const currRecord = currSnapshot.data?.records?.data?.find(r => r.strikePrice === strike);
                const prevRecord = prevSnapshot.data?.records?.data?.find(r => r.strikePrice === strike);
                if ((currRecord?.CE?.openInterest || 0) !== (prevRecord?.CE?.openInterest || 0)) { hasOIChange = true; break; }
                if ((currRecord?.PE?.openInterest || 0) !== (prevRecord?.PE?.openInterest || 0)) { hasOIChange = true; break; }
            }
            if (hasOIChange) finalHistory.push(currSnapshot);
        });
        finalHistory.reverse();
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap justify-between items-center mb-2 gap-3 bg-gray-50 p-2 rounded border">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-xs font-semibold text-gray-700">Columns:</span>
                    {['oi', 'oiValue', 'volume', 'iv', 'ltp'].map(col => (
                        <label key={col} className="flex items-center gap-1 text-[11px] md:text-sm cursor-pointer select-none capitalize">
                            <input
                                type="checkbox"
                                checked={visibleColumns[col]}
                                onChange={(e) => setVisibleColumns({ ...visibleColumns, [col]: e.target.checked })}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            {col === 'oiValue' ? 'OI Val' : col}
                        </label>
                    ))}
                </div>
                <button
                    onClick={downloadExcel}
                    className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white text-[11px] md:text-sm font-medium rounded hover:bg-green-700 transition-colors shadow-sm ml-auto"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                </button>
            </div>

            {finalHistory.map((snapshot, index) => {
                const timestamp = new Date(snapshot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const spotPrice = snapshot.data?.records?.underlyingValue || 0;
                const atmStrike = findClosestStrike(spotPrice, 50);
                const range = (strikeCount - 1) / 2;
                const strikesToShow = [];
                for (let i = -range; i <= range; i++) {
                    strikesToShow.push(atmStrike + (i * 50));
                }
                const prevSnapshot = finalHistory[index + 1];
                const relevantData = strikesToShow.map(strike => {
                    const record = snapshot.data?.records?.data?.find(r => r.strikePrice === strike);
                    const prevRecord = prevSnapshot?.data?.records?.data?.find(r => r.strikePrice === strike);
                    const currCE = record?.CE?.openInterest || 0;
                    const prevCE = prevRecord?.CE?.openInterest || 0;
                    let diffCE = 0;
                    if (prevSnapshot) diffCE = currCE - prevCE;
                    else if (record?.CE?.diffOpenInterest !== undefined) diffCE = record.CE.diffOpenInterest;
                    const currCEVol = record?.CE?.totalTradedVolume || 0;
                    const prevCEVol = prevRecord?.CE?.totalTradedVolume || 0;
                    let diffCEVol = 0;
                    if (prevSnapshot) diffCEVol = currCEVol - prevCEVol;
                    else if (record?.CE?.diffTotalTradedVolume !== undefined) diffCEVol = record.CE.diffTotalTradedVolume;
                    const currPE = record?.PE?.openInterest || 0;
                    const prevPE = prevRecord?.PE?.openInterest || 0;
                    let diffPE = 0;
                    if (prevSnapshot) diffPE = currPE - prevPE;
                    else if (record?.PE?.diffOpenInterest !== undefined) diffPE = record.PE.diffOpenInterest;
                    const currPEVol = record?.PE?.totalTradedVolume || 0;
                    const prevPEVol = prevRecord?.PE?.totalTradedVolume || 0;
                    let diffPEVol = 0;
                    if (prevSnapshot) diffPEVol = currPEVol - prevPEVol;
                    else if (record?.PE?.diffTotalTradedVolume !== undefined) diffPEVol = record.PE.diffTotalTradedVolume;
                    return {
                        strike, CE: record?.CE || {}, PE: record?.PE || {},
                        diffCE, diffPE, diffCEVol, diffPEVol,
                        hasPrev: !!prevSnapshot || (record?.CE?.diffOpenInterest !== undefined)
                    };
                });
                const totalScale = Math.max(...relevantData.map(r => Math.max(r.CE.openInterest || 0, r.PE.openInterest || 0)), 0) * 1.05;

                return (
                    <div key={index} className="bg-white border rounded-lg shadow-sm overflow-hidden text-sm mb-4">
                        <div className="bg-gray-50 px-3 md:px-4 py-2 border-b flex justify-between items-center text-xs md:text-sm">
                            <span className="font-bold text-gray-700">
                                {timestamp}
                                {snapshot.data?.nseTimestamp && <span className="text-[10px] md:text-xs font-normal text-blue-600 ml-1 md:ml-2">(NSE: {snapshot.data.nseTimestamp})</span>}
                            </span>
                            <span className="text-gray-500">Spot: <span className="font-mono text-black font-semibold">{spotPrice}</span></span>
                        </div>

                        <div className="overflow-x-auto">
                            <div className="min-w-[700px] md:min-w-[800px]">
                                <div className="grid text-center bg-gray-100 font-semibold text-[10px] md:text-xs py-2 border-b items-center gap-0" style={gridStyle}>
                                    {visibleColumns.oi && <div className="text-gray-600">OI</div>}
                                    {visibleColumns.oiValue && <div className="text-gray-600">CE OI Val</div>}
                                    {visibleColumns.volume && <div className="text-gray-600">Vol</div>}
                                    {visibleColumns.iv && <div className="text-gray-600">IV</div>}
                                    {visibleColumns.ltp && <div className="text-gray-600">CE LTP</div>}
                                    <div className="text-gray-800">Strike</div>
                                    {visibleColumns.ltp && <div className="text-gray-600">PE LTP</div>}
                                    {visibleColumns.iv && <div className="text-gray-600">IV</div>}
                                    {visibleColumns.volume && <div className="text-gray-600">Vol</div>}
                                    {visibleColumns.oiValue && <div className="text-gray-600">PE OI Val</div>}
                                    {visibleColumns.oi && <div className="text-gray-600">OI</div>}
                                </div>

                                {relevantData.map((row, rIndex) => (
                                    <div key={rIndex} className={`border-b last:border-0 ${row.strike === atmStrike ? 'bg-yellow-50' : 'bg-white'}`}>
                                        <div className="grid text-center py-1.5 md:py-2 items-center gap-0" style={gridStyle}>
                                            {visibleColumns.oi && (
                                                <div className="flex justify-center items-center gap-1 md:gap-2">
                                                    {row.hasPrev && (
                                                        <div className="flex flex-col items-end">
                                                            <span className={`text-[8px] md:text-[10px] font-semibold ${row.diffCE >= 0 ? 'text-green-500' : 'text-red-500'}`}>{row.diffCE > 0 ? '+' : ''}{formatNumber(row.diffCE)}</span>
                                                        </div>
                                                    )}
                                                    <span className="font-bold text-gray-800 text-[11px] md:text-sm">{formatNumber(row.CE.openInterest || 0)}</span>
                                                </div>
                                            )}
                                            {visibleColumns.oiValue && (
                                                <div className="flex justify-center items-center gap-1 md:gap-2">
                                                    <div className="text-[10px] md:text-xs font-bold text-black">{((row.CE.openInterest * LOT_SIZE) / 100000).toFixed(2)}</div>
                                                </div>
                                            )}
                                            {visibleColumns.volume && (
                                                <div className="flex flex-col justify-center items-center">
                                                    <div className="text-[10px] md:text-xs text-gray-500">{formatNumber(row.CE.totalTradedVolume || 0)}</div>
                                                </div>
                                            )}
                                            {visibleColumns.iv && <div className="text-gray-600 text-[10px] md:text-xs">{row.CE.impliedVolatility || '-'}</div>}
                                            {visibleColumns.ltp && <div className="font-mono text-[11px] md:text-sm">{row.CE.lastPrice || '-'}</div>}
                                            <div className="flex items-center justify-center font-bold bg-gray-200 rounded mx-0.5 md:mx-1 text-gray-800 text-[11px] md:text-xs py-0.5 md:py-1">{row.strike}</div>
                                            {visibleColumns.ltp && <div className="font-mono text-[11px] md:text-sm">{row.PE.lastPrice || '-'}</div>}
                                            {visibleColumns.iv && <div className="text-gray-600 text-[10px] md:text-xs">{row.PE.impliedVolatility || '-'}</div>}
                                            {visibleColumns.volume && (
                                                <div className="flex flex-col justify-center items-center">
                                                    <div className="text-[10px] md:text-xs text-gray-500">{formatNumber(row.PE.totalTradedVolume || 0)}</div>
                                                </div>
                                            )}
                                            {visibleColumns.oiValue && (
                                                <div className="flex justify-center items-center gap-1 md:gap-2">
                                                    <div className="text-[10px] md:text-xs font-bold text-black">{((row.PE.openInterest * LOT_SIZE) / 100000).toFixed(2)}</div>
                                                </div>
                                            )}
                                            {visibleColumns.oi && (
                                                <div className="flex justify-center items-center gap-1 md:gap-2">
                                                    <span className="font-bold text-gray-800 text-[11px] md:text-sm">{formatNumber(row.PE.openInterest || 0)}</span>
                                                    {row.hasPrev && (
                                                        <div className="flex flex-col items-start">
                                                            <span className={`text-[8px] md:text-[10px] font-semibold ${row.diffPE >= 0 ? 'text-green-500' : 'text-red-500'}`}>{row.diffPE > 0 ? '+' : ''}{formatNumber(row.diffPE)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="w-full h-1.5 md:h-2 flex items-stretch px-2 pb-1 gap-0">
                                            <div className="flex-1 bg-gray-200 flex justify-end items-stretch overflow-hidden">
                                                <div className="h-full" style={{ width: `${totalScale > 0 ? (row.CE.openInterest / totalScale) * 100 : 0}%`, background: 'linear-gradient(to right, #ef4444, #fca5a5)' }}></div>
                                            </div>
                                            <div className="w-0.5 md:w-1 bg-gray-400"></div>
                                            <div className="flex-1 bg-gray-200 flex justify-start items-stretch overflow-hidden">
                                                <div className="h-full" style={{ width: `${totalScale > 0 ? (row.PE.openInterest / totalScale) * 100 : 0}%`, background: 'linear-gradient(to right, #86efac, #22c55e)' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default SnapshotTable;
