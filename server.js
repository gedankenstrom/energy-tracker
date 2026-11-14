const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');

const app = express();
app.use(bodyParser.json());

// Statische Dateien servieren
app.use(express.static(__dirname));

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'data.json');
const metersFile = path.join(dataDir, 'meters.json');
const meterHistoryFile = path.join(dataDir, 'meterHistory.json');
const providersFile = path.join(dataDir, 'providers.json');
fs.ensureDirSync(dataDir);

if (!fs.existsSync(dataFile)) fs.writeJsonSync(dataFile, []);
if (!fs.existsSync(metersFile)) {
  const initialMeters = {
    Strom: '',
    Gas: '',
    'Wasser Abstellraum': '',
    'Wasser Treppe': '',
    'Wasser Waschküche': ''
  };
  fs.writeJsonSync(metersFile, initialMeters);
}
if (!fs.existsSync(meterHistoryFile)) fs.writeJsonSync(meterHistoryFile, {});
if (!fs.existsSync(providersFile)) {
  const initialProviders = {
    Strom: { name: '', website: '', contractStart: '', contractEnd: '' },
    Gas: { name: '', website: '', contractStart: '', contractEnd: '' }
  };
  fs.writeJsonSync(providersFile, initialProviders);
}

const READING_DAY = parseInt(process.env.READING_DAY) || 1;

function germanFormat(number) {
  if (number === null || number === undefined) return '0,0';
  return number.toFixed(1).replace('.', ',');
}

function getConsumptionMonth(readingDate) {
  const date = new Date(readingDate);
  const readingDay = date.getDate();
  
  if (readingDay >= 1 && readingDay <= 3) {
    date.setMonth(date.getMonth() - 1);
  }
  
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    monthKey: date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'),
    monthName: date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  };
}

console.log('Energie-Tracker Server gestartet');
console.log('VERBRAUCHSLOGIK: 1.-3. des Monats → Vormonat, 4.-31. → aktueller Monat');

app.get('/api/config', (req, res) => {
  res.json({ readingDay: READING_DAY });
});

app.get('/api/providers', async (req, res) => {
  try {
    const providers = await fs.readJson(providersFile);
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Anbieterdaten' });
  }
});

app.post('/api/providers', async (req, res) => {
  try {
    const { type, providerData } = req.body;
    let providers = await fs.readJson(providersFile);
    
    if (providers[type]) {
      providers[type] = { ...providers[type], ...providerData };
      await fs.writeJson(providersFile, providers, { spaces: 2 });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Ungültiger Zählertyp' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Speichern der Anbieterdaten' });
  }
});

app.get('/api/entries', async (req, res) => {
  try {
    const { type } = req.query;
    let entries = await fs.readJson(dataFile);
    
    if (type) {
      entries = entries.filter(entry => entry.type === type);
    }
    
    const entriesWithConsumption = calculateConsumption(entries);
    
    const entriesWithConsumptionMonth = entriesWithConsumption.map(entry => {
      const consumptionMonth = getConsumptionMonth(entry.date);
      return {
        ...entry,
        consumptionMonth: consumptionMonth.monthName
      };
    });
    
    res.json(entriesWithConsumptionMonth);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Daten' });
  }
});

app.get('/api/meters', async (req, res) => {
  try {
    const meters = await fs.readJson(metersFile);
    res.json(meters);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Zählernummern' });
  }
});

app.get('/api/meter-history', async (req, res) => {
  try {
    const meterHistory = await fs.readJson(meterHistoryFile);
    res.json(meterHistory);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Zählerhistorie' });
  }
});

app.post('/api/meters', async (req, res) => {
  try {
    const { type, meterNumber, isNewMeter } = req.body;
    let meters = await fs.readJson(metersFile);
    let meterHistory = await fs.readJson(meterHistoryFile);
    
    if (meters[type] && meters[type] !== meterNumber) {
      if (!meterHistory[type]) {
        meterHistory[type] = [];
      }
      meterHistory[type].push({
        meterNumber: meters[type],
        changedAt: new Date().toISOString(),
        changedTo: meterNumber,
        isNewMeter: isNewMeter || false
      });
      await fs.writeJson(meterHistoryFile, meterHistory, { spaces: 2 });
    }
    
    meters[type] = meterNumber;
    await fs.writeJson(metersFile, meters, { spaces: 2 });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Speichern der Zählernummer' });
  }
});

app.get('/api/consumption-stats', async (req, res) => {
  try {
    const { type } = req.query;
    if (!type) {
      return res.status(400).json({ error: 'Zählertyp erforderlich' });
    }
    
    let entries = await fs.readJson(dataFile);
    
    if (type === 'Wasser Gesamt') {
      const waterEntries = entries.filter(entry => entry.type.includes('Wasser') && entry.type !== 'Wasser Gesamt');
      
      if (waterEntries.length === 0) {
        return res.json({
          yearlyConsumption: 0,
          monthlyAverage: 0,
          totalConsumption: 0,
          entryCount: 0,
          yearlyConsumptionFormatted: '0,0',
          monthlyAverageFormatted: '0,0',
          totalConsumptionFormatted: '0,0'
        });
      }
      
      const entriesByDate = {};
      waterEntries.forEach(entry => {
        if (!entriesByDate[entry.date]) {
          entriesByDate[entry.date] = {
            date: entry.date,
            types: new Set(),
            totalValue: 0,
            totalActualConsumption: 0,
            totalCumulativeConsumption: 0
          };
        }
        entriesByDate[entry.date].types.add(entry.type);
        entriesByDate[entry.date].totalValue += entry.value;
        
        const entriesForType = waterEntries.filter(e => e.type === entry.type);
        const sortedEntries = [...entriesForType].sort((a, b) => new Date(a.date) - new Date(b.date));
        const entryIndex = sortedEntries.findIndex(e => e.id === entry.id);
        
        let actualConsumption = 0;
        if (entryIndex > 0) {
          actualConsumption = entry.value - sortedEntries[entryIndex - 1].value;
        }
        
        entriesByDate[entry.date].totalActualConsumption += actualConsumption;
      });
      
      const sortedDates = Object.keys(entriesByDate).sort();
      let cumulativeConsumption = 0;
      sortedDates.forEach(date => {
        cumulativeConsumption += entriesByDate[date].totalActualConsumption;
        entriesByDate[date].totalCumulativeConsumption = cumulativeConsumption;
      });
      
      const combinedEntries = sortedDates.map(date => ({
        date: date,
        value: entriesByDate[date].totalValue,
        actualConsumption: entriesByDate[date].totalActualConsumption,
        cumulativeConsumption: entriesByDate[date].totalCumulativeConsumption,
        type: 'Wasser Gesamt'
      }));
      
      const stats = calculateConsumptionStats(combinedEntries);
      stats.entryCount = waterEntries.length;
      res.json(stats);
      
    } else {
      entries = entries.filter(entry => entry.type === type);
      
      if (entries.length === 0) {
        return res.json({
          yearlyConsumption: 0,
          monthlyAverage: 0,
          totalConsumption: 0,
          entryCount: 0,
          yearlyConsumptionFormatted: '0,0',
          monthlyAverageFormatted: '0,0',
          totalConsumptionFormatted: '0,0'
        });
      }
      
      const entriesWithConsumption = calculateConsumption(entries);
      const stats = calculateConsumptionStats(entriesWithConsumption);
      res.json(stats);
    }
  } catch (error) {
    console.error('Fehler beim Berechnen der Verbrauchsstatistiken:', error);
    res.status(500).json({ error: 'Fehler beim Berechnen der Verbrauchsstatistiken' });
  }
});

app.get('/api/monthly-consumption', async (req, res) => {
  try {
    const { type } = req.query;
    if (!type) {
      return res.status(400).json({ error: 'Zählertyp erforderlich' });
    }
    
    let entries = await fs.readJson(dataFile);
    
    if (type === 'Wasser Gesamt') {
      entries = entries.filter(entry => entry.type.includes('Wasser') && entry.type !== 'Wasser Gesamt');
    } else {
      entries = entries.filter(entry => entry.type === type);
    }
    
    if (entries.length === 0) {
      return res.json([]);
    }
    
    const monthlyData = calculateMonthlyConsumption(entries, type);
    res.json(monthlyData);
  } catch (error) {
    console.error('Fehler beim Berechnen der monatlichen Verbrauchsdaten:', error);
    res.status(500).json({ error: 'Fehler beim Berechnen der monatlichen Verbrauchsdaten' });
  }
});

function calculateMonthlyConsumption(entries, type) {
  const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const entriesWithConsumption = calculateConsumption(sortedEntries);
  const monthlyGroups = {};
  
  entriesWithConsumption.forEach(entry => {
    if (entry.actualConsumption > 0) {
      const consumptionMonth = getConsumptionMonth(entry.date);
      const monthKey = consumptionMonth.monthKey;
      
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = {
          year: consumptionMonth.year,
          month: consumptionMonth.month,
          monthName: consumptionMonth.monthName,
          consumption: 0,
          readingDate: entry.date,
          entries: []
        };
      }
      
      monthlyGroups[monthKey].consumption += entry.actualConsumption;
      monthlyGroups[monthKey].entries.push(entry);
    }
  });
  
  const result = [];
  const today = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const monthKey = year + '-' + String(month).padStart(2, '0');
    
    const monthName = targetDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    
    result.push({
      year: year,
      month: month,
      monthName: monthName,
      consumption: monthlyGroups[monthKey] ? monthlyGroups[monthKey].consumption : 0,
      consumptionFormatted: germanFormat(monthlyGroups[monthKey] ? monthlyGroups[monthKey].consumption : 0),
      readingDate: monthlyGroups[monthKey] ? monthlyGroups[monthKey].readingDate : null,
      entryCount: monthlyGroups[monthKey] ? monthlyGroups[monthKey].entries.length : 0
    });
  }
  
  return result;
}

app.get('/api/export/csv', async (req, res) => {
  try {
    const { type } = req.query;
    let entries = await fs.readJson(dataFile);
    const meterHistory = await fs.readJson(meterHistoryFile);
    
    if (type) {
      if (type === 'Wasser Gesamt') {
        entries = entries.filter(entry => entry.type.includes('Wasser') && entry.type !== 'Wasser Gesamt');
      } else {
        entries = entries.filter(entry => entry.type === type);
      }
    }
    
    const entriesWithConsumption = calculateConsumption(entries);
    const meters = await fs.readJson(metersFile);
    
    const bom = '\uFEFF';
    let csv = bom + 'Datum;Zählertyp;Zählernummer;Zählerstand;Verbrauch;Kumulativer_Verbrauch;Status;Verbrauchsmonat\r\n';
    
    entriesWithConsumption.forEach(entry => {
      let status = '';
      if (entry.isNewMeter) status = 'Neuer Zähler';
      
      let meterNumber = findMeterNumberForEntry(entry, meterHistory, meters);
      const consumptionMonth = getConsumptionMonth(entry.date);
      
      csv += '"' + entry.date + '";"' + entry.type + '";"' + meterNumber + '";' + 
             germanFormat(entry.value) + ';' + germanFormat(entry.actualConsumption) + ';' + 
             germanFormat(entry.cumulativeConsumption) + ';"' + status + '";"' + consumptionMonth.monthName + '"\r\n';
    });
    
    const filename = type ? 'energieverbrauch_' + type + '.csv' : 'energieverbrauch_alle.csv';
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim CSV-Export' });
  }
});

function findMeterNumberForEntry(entry, meterHistory, currentMeters) {
  const entryDate = new Date(entry.date);
  const type = entry.type;
  
  if (!meterHistory[type] || meterHistory[type].length === 0) {
    return currentMeters[type] || '';
  }
  
  const sortedHistory = [...meterHistory[type]].sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
  
  for (const historyItem of sortedHistory) {
    if (new Date(historyItem.changedAt) <= entryDate) {
      return historyItem.changedTo;
    }
  }
  
  return sortedHistory[sortedHistory.length - 1]?.meterNumber || currentMeters[type] || '';
}

function calculateConsumption(entries) {
  const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const consumptionByType = {};
  
  return sortedEntries.map((entry, index) => {
    const previousEntries = sortedEntries
      .slice(0, index)
      .filter(e => e.type === entry.type);
    
    let actualConsumption = 0;
    let cumulativeConsumption = 0;
    
    if (previousEntries.length === 0) {
      consumptionByType[entry.type] = 0;
      actualConsumption = 0;
      cumulativeConsumption = 0;
    } else {
      const lastEntry = previousEntries[previousEntries.length - 1];
      
      if (entry.isNewMeter) {
        actualConsumption = entry.value;
        cumulativeConsumption = consumptionByType[entry.type] + actualConsumption;
      } else {
        actualConsumption = entry.value - lastEntry.value;
        cumulativeConsumption = consumptionByType[entry.type] + actualConsumption;
      }
      consumptionByType[entry.type] = cumulativeConsumption;
    }
    
    return {
      ...entry,
      actualConsumption: actualConsumption,
      cumulativeConsumption: cumulativeConsumption,
      valueFormatted: germanFormat(entry.value),
      actualConsumptionFormatted: germanFormat(actualConsumption),
      cumulativeConsumptionFormatted: germanFormat(cumulativeConsumption)
    };
  });
}

function calculateConsumptionStats(entries) {
  if (entries.length === 0) {
    return {
      yearlyConsumption: 0,
      monthlyAverage: 0,
      totalConsumption: 0,
      entryCount: 0,
      yearlyConsumptionFormatted: '0,0',
      monthlyAverageFormatted: '0,0',
      totalConsumptionFormatted: '0,0'
    };
  }
  
  const totalConsumption = entries[entries.length - 1].cumulativeConsumption;
  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];
  
  const firstDate = new Date(firstEntry.date);
  const lastDate = new Date(lastEntry.date);
  
  const monthDiff = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                   (lastDate.getMonth() - firstDate.getMonth()) + 1;
  
  const monthlyAverage = monthDiff > 0 ? totalConsumption / monthDiff : totalConsumption;
  
  let yearlyConsumption = 0;
  if (entries.length > 1) {
    const oneYearAgo = new Date(lastDate);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const entriesLastYear = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= oneYearAgo;
    });
    
    if (entriesLastYear.length > 0) {
      const firstEntryYear = entriesLastYear[0];
      yearlyConsumption = lastEntry.cumulativeConsumption - firstEntryYear.cumulativeConsumption;
    } else {
      yearlyConsumption = totalConsumption;
    }
  }
  
  return {
    yearlyConsumption: yearlyConsumption,
    monthlyAverage: monthlyAverage,
    totalConsumption: totalConsumption,
    entryCount: entries.length,
    firstDate: firstEntry.date,
    lastDate: lastEntry.date,
    monthCount: monthDiff,
    yearlyConsumptionFormatted: germanFormat(yearlyConsumption),
    monthlyAverageFormatted: germanFormat(monthlyAverage),
    totalConsumptionFormatted: germanFormat(totalConsumption)
  };
}

app.delete('/api/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let entries = await fs.readJson(dataFile);
    
    const initialLength = entries.length;
    entries = entries.filter(entry => entry.id !== parseInt(id));
    
    if (entries.length === initialLength) {
      return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    }

    await fs.writeJson(dataFile, entries, { spaces: 2 });
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

app.post('/api/entries', async (req, res) => {
  try {
    const { type, value, date, isNewMeter, updateMeterNumber } = req.body;
    let entries = await fs.readJson(dataFile);

    const entry = { 
      id: Date.now(),
      date: date || new Date().toISOString().split('T')[0],
      type,
      value: parseFloat(value),
      isNewMeter: !!isNewMeter
    };
    
    entries.push(entry);
    await fs.writeJson(dataFile, entries, { spaces: 2 });
    
    if (isNewMeter && updateMeterNumber) {
      let meters = await fs.readJson(metersFile);
      await fetch('http://localhost:3000/api/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type, 
          meterNumber: updateMeterNumber,
          isNewMeter: true 
        })
      });
    }
    
    const typeEntries = entries.filter(e => e.type === type);
    const entriesWithConsumption = calculateConsumption(typeEntries);
    
    const newEntry = entriesWithConsumption[entriesWithConsumption.length - 1];
    const consumptionMonth = getConsumptionMonth(newEntry.date);
    const newEntryWithMonth = {
      ...newEntry,
      consumptionMonth: consumptionMonth.monthName
    };
    
    res.json(newEntryWithMonth);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
app.listen(PORT, () => console.log("Energie-Tracker läuft auf Port " + PORT));
