// PerformanceMapLocal.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Text,
  Flex,
  Spinner,
  Select,
  Grid,
  useToast,
  IconButton,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Button,
} from "@chakra-ui/react";
import Papa from "papaparse";
import { FaExpand } from "react-icons/fa";
import Plot from "react-plotly.js";

/** ========== Helpers ========== */

// Parse YYYY-MM-DD -> Date
const parseDate = (dateStr) => {
  if (!dateStr) return new Date(0);
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// Format "YYYY-MM-DD" range -> "MMM DD, YYYY - MMM DD, YYYY"
const formatDateRange = (start, end) => {
  if (!start || !end) return "N/A";
  const sDate = parseDate(start);
  const eDate = parseDate(end);
  const opts = { month: "short", day: "numeric", year: "numeric" };
  return `${sDate.toLocaleDateString(undefined, opts)} - ${eDate.toLocaleDateString(undefined, opts)}`;
};

// Format numeric with or without decimals
const formatNumber = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return "N/A";
  return Number.isInteger(num) ? num.toString() : num.toFixed(1);
};

// “Local” aggregator
function getAggregatedLocalData(dataRows, metric) {
  const mapByDate = {};
  dataRows.forEach((row) => {
    if (row.metric === metric) {
      const dateKey = row.endDate;
      if (!mapByDate[dateKey]) {
        mapByDate[dateKey] = [];
      }
      mapByDate[dateKey].push(row.p75);
    }
  });
  const aggregated = Object.keys(mapByDate).map((date) => {
    const sum = mapByDate[date].reduce((a, b) => a + b, 0);
    const avg = sum / mapByDate[date].length;
    return { date, value: avg };
  });
  // Sort ascending by date
  aggregated.sort((a, b) => parseDate(a.date) - parseDate(b.date));
  return aggregated;
}

// Single-company data
function getSingleCompanyData(dataRows, metric) {
  return dataRows
    .filter((row) => row.metric === metric)
    .sort((a, b) => parseDate(a.endDate) - parseDate(b.endDate))
    .map((row) => ({
      date: row.endDate,
      value: row.p75,
    }));
}

// Identify the most recent date for marking with a vertical line
function getMostRecentDate(dataArray) {
  let maxTime = 0;
  dataArray.forEach((item) => {
    const t = parseDate(item.date).getTime();
    if (t > maxTime) maxTime = t;
  });
  return maxTime > 0 ? new Date(maxTime) : null;
}

/** ========== Constants ========== */

// Company to URL mapping
const COMPANY_URLS = {
  QuintanaRoo: "https://www.aztecaquintanaroo.com",
  Bajio: "https://www.aztecabajio.com",
  CiudadJuarez: "https://www.aztecaciudadjuarez.com",
  Yucatan: "https://www.aztecayucatan.com",
  Jalisco: "https://www.aztecajalisco.com",
  Puebla: "https://www.aztecapuebla.com",
  Veracruz: "https://www.aztecaveracruz.com",
  BajaCalifornia: "https://www.tvaztecabajacalifornia.com",
  Morelos: "https://www.aztecamorelos.com",
  Guerrero: "https://www.aztecaguerrero.com",
  Chiapas: "https://www.aztecachiapas.com",
  Sinaloa: "https://www.aztecasinaloa.com",
  Aguascalientes: "https://www.aztecaaguascalientes.com",
  Queretaro: "https://www.aztecaqueretaro.com",
  Chihuahua: "https://www.aztecachihuahua.com",
  Laguna: "https://www.aztecalaguna.com",
};

// Group “Local”
const GROUPS = {
  Local: [
    "QuintanaRoo",
    "Bajio",
    "CiudadJuarez",
    "Yucatan",
    "Jalisco",
    "Puebla",
    "Veracruz",
    "BajaCalifornia",
    "Morelos",
    "Guerrero",
    "Chiapas",
    "Sinaloa",
    "Aguascalientes",
    "Queretaro",
    "Chihuahua",
    "Laguna",
  ],
};

const GROUP_NAMES = Object.keys(GROUPS);
const INDIVIDUAL_COMPANIES = Object.values(GROUPS).flat(); // Removed the empty string

// 5 metrics
const METRICS = ["LCP", "CLS", "INP", "FCP", "TTFB"];

// Units
const METRIC_UNITS = {
  LCP: "ms",
  CLS: "",
  INP: "ms",
  FCP: "ms",
  TTFB: "ms",
};

// Thresholds
const THRESHOLDS = {
  FCP: { good: 1800, needsImprovement: 3000 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  INP: { good: 200, needsImprovement: 500 },
  TTFB: { good: 800, needsImprovement: 1800 },
  LCP: { good: 2500, needsImprovement: 4000 },
};

// Metric Definitions
const METRIC_DEFINITIONS = {
  LCP: "Largest Contentful Paint measures loading performance. It marks the time at which the largest text or image is painted.",
  CLS: "Cumulative Layout Shift measures visual stability. It quantifies how much the page layout shifts during the loading phase.",
  INP: "Interaction to Next Paint measures responsiveness. It records the latency of user interactions with the page.",
  FCP: "First Contentful Paint measures when the first text or image is painted on the screen.",
  TTFB: "Time To First Byte measures the responsiveness of a web server. It marks the time from the request until the first byte is received.",
};

/** ========== Component ========== */

const PerformanceMapLocal = () => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Default selection
  const [selectedCompany, setSelectedCompany] = useState("Local");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [availableWeeks, setAvailableWeeks] = useState([]);

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [modalPlotData, setModalPlotData] = useState(null);
  const [modalMetric, setModalMetric] = useState("");

  // Fetch data
  useEffect(() => {
    const csvUrl =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTjlmJmlds_-tGsyyuE---iB_dPSDjLIxWb0D5ZSqz5KiJJIOFr5_AJND3p7lMaOZ1Bz7fwl8HPP0Mg/pub?output=csv";
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed = results.data.map((row) => ({
            website: row["Website"]?.trim() ?? "",
            metric: row["Metric"]?.trim().toUpperCase() ?? "",
            p75: row["P75"] ? parseFloat(row["P75"]) : NaN,
            startDate: row["Start Date"]?.trim() ?? "",
            endDate: row["End Date"]?.trim() ?? "",
            weekRange:
              row["Start Date"] && row["End Date"]
                ? formatDateRange(row["Start Date"].trim(), row["End Date"].trim())
                : "N/A",
          }));

          // Filter valid
          const validData = parsed.filter((r, idx) => {
            if (!r.website) {
              console.warn(`Row ${idx + 2} missing 'Website'`);
              return false;
            }
            if (!r.metric) {
              console.warn(`Row ${idx + 2} missing 'Metric'`);
              return false;
            }
            if (isNaN(r.p75)) {
              console.warn(`Row ${idx + 2} invalid 'P75'`);
              return false;
            }
            return true;
          });

          // Unique weeks
          const weeks = Array.from(new Set(validData.map((d) => d.weekRange)));
          weeks.sort((a, b) => {
            const dateA = a.split(" - ")[0] ? parseDate(a.split(" - ")[0]) : new Date(0);
            const dateB = b.split(" - ")[0] ? parseDate(b.split(" - ")[0]) : new Date(0);
            return dateA - dateB;
          });
          setAvailableWeeks(weeks);

          setData(validData);
          setIsLoading(false);
        } catch (err) {
          console.error("Error processing CSV data:", err);
          setError(`Failed to process: ${err.message}`);
          setIsLoading(false);
        }
      },
      error: (err) => {
        console.error("Error fetching CSV:", err);
        setError(`Failed to fetch: ${err.message}`);
        setIsLoading(false);
      },
    });
  }, []);

  // Company select options (Groups + Individuals)
  const companyOptions = useMemo(() => {
    const opts = [];
    // Add "Local"
    opts.push(
      <option
        key="Local"
        value="Local"
        style={
          selectedCompany === "Local" ? { color: "white", fontWeight: "bold" } : {}
        }
      >
        Local
      </option>
    );

    // Add each individual company without any empty option
    INDIVIDUAL_COMPANIES.forEach((co) => {
      opts.push(
        <option
          key={co}
          value={co}
          style={selectedCompany === co ? { color: "white", fontWeight: "bold" } : {}}
        >
          {co}
        </option>
      );
    });
    return opts;
  }, [selectedCompany]);

  // Filtered data by company + week
  const filteredData = useMemo(() => {
    if (!data.length) return [];

    return data.filter((row) => {
      // Week filter
      if (selectedWeek && selectedWeek !== "All Weeks") {
        if (row.weekRange !== selectedWeek) return false;
      }
      // If "Local," aggregator logic happens later. Just pass it along.
      if (selectedCompany === "Local") {
        // All items that belong to local group
        const localCompanies = GROUPS["Local"];
        const localURLs = localCompanies.map((c) => COMPANY_URLS[c]);
        return localURLs.includes(row.website);
      } else if (selectedCompany) {
        // Single company
        const selectedURL = COMPANY_URLS[selectedCompany];
        return row.website === selectedURL;
      }
      return true;
    });
  }, [data, selectedCompany, selectedWeek]);

  // Build final “series” for each metric
  const plotlySeries = useMemo(() => {
    const seriesByMetric = {};

    METRICS.forEach((metric) => {
      if (selectedCompany === "Local") {
        // Aggregated
        const points = getAggregatedLocalData(filteredData, metric);
        seriesByMetric[metric] = points;
      } else {
        // Single
        const points = getSingleCompanyData(filteredData, metric);
        seriesByMetric[metric] = points;
      }
    });
    return seriesByMetric;
  }, [filteredData, selectedCompany]);

  // Averages
  const averages = useMemo(() => {
    if (!filteredData.length) return {};

    const sums = {};
    const counts = {};
    METRICS.forEach((m) => {
      sums[m] = 0;
      counts[m] = 0;
    });

    filteredData.forEach((row) => {
      if (METRICS.includes(row.metric) && !isNaN(row.p75)) {
        sums[row.metric] += row.p75;
        counts[row.metric] += 1;
      }
    });

    const result = {};
    METRICS.forEach((m) => {
      if (counts[m] > 0) {
        result[m] = (sums[m] / counts[m]).toFixed(2);
      } else {
        result[m] = "N/A";
      }
    });
    return result;
  }, [filteredData]);

  // Most recent date for shape
  const mostRecentDate = useMemo(() => {
    let allPoints = [];
    Object.values(plotlySeries).forEach((arr) => {
      allPoints = allPoints.concat(arr);
    });
    const dt = getMostRecentDate(allPoints);
    return dt; // May be null
  }, [plotlySeries]);

  // Current date line in Plotly
  const getCurrentDateLine = (dt) => {
    if (!dt) return {};
    const iso = dt.toISOString().split("T")[0]; // 'YYYY-MM-DD'
    return {
      shapes: [
        {
          type: "line",
          xref: "x",
          yref: "paper",
          x0: iso,
          x1: iso,
          y0: 0,
          y1: 1,
          line: {
            color: "gray",
            width: 2,
            dash: "dot",
          },
        },
      ],
      annotations: [
        {
          x: iso,
          y: 1,
          xref: "x",
          yref: "paper",
          text: "", // If you want a label, put it here
          showarrow: true,
          arrowhead: 2,
          ax: 0,
          ay: -40,
          font: { color: "white" },
        },
      ],
    };
  };

  // Expand modal
  const handleExpand = (plotData, metric) => {
    setModalPlotData(plotData);
    setModalMetric(metric);
    onOpen();
  };

  // Handlers
  const handleCompanyChange = (e) => {
    setSelectedCompany(e.target.value);
  };

  const handleWeekChange = (e) => {
    setSelectedWeek(e.target.value);
    if (e.target.value && e.target.value !== "All Weeks") {
      toast({
        title: "Week Selected",
        description: `Viewing data for: ${e.target.value}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const showAllWeeks = () => {
    setSelectedWeek("All Weeks");
  };

  if (isLoading) {
    return (
      <Flex justifyContent="center" alignItems="center" height="50vh" bg="transparent">
        <Spinner size="xl" color="teal.500" />
        <Text ml={4} fontSize="xl" color="white">
          Loading data...
        </Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex justifyContent="center" alignItems="center" height="50vh" bg="transparent">
        <Text color="red.500" fontSize="xl" textAlign="center">
          {error}
        </Text>
      </Flex>
    );
  }

  return (
    <>
      <Flex
        direction="column"
        gap={4}
        width="100%"
        maxW="1200px"
        align="center"
        p={4}
        mx="auto"
        bg="transparent"
      >
        {/* Controls Row */}
        <Flex
          width="100%"
          justifyContent="flex-start"
          alignItems="center"
          flexWrap="wrap"
          gap={4}
          bg="transparent"
        >
          {/* Company */}
          <Flex alignItems="center" gap={2}>
            <Text color="white" fontSize="md" fontWeight="semibold">
              Company:
            </Text>
            <Select
              value={selectedCompany}
              onChange={handleCompanyChange}
              width="200px"
              bg="transparent"
              borderRadius="md"
              border="1px solid rgba(255, 255, 255, 0.6)"
              size="sm"
              _placeholder={{ color: "gray.300" }}
            >
              {companyOptions}
            </Select>
          </Flex>

          {/* Week */}
          <Flex alignItems="center" gap={2}>
            <Text color="white" fontSize="md" fontWeight="semibold">
              Week:
            </Text>
            <Select
              value={selectedWeek}
              onChange={handleWeekChange}
              placeholder="Select Week"
              width="200px"
              bg="transparent"
              borderRadius="md"
              border="1px solid rgba(255, 255, 255, 0.6)"
              size="sm"
              _placeholder={{ color: "gray.300" }}
            >
              {/* “All Weeks” is also an option in the dropdown,
                  or you can just rely on the button below */}
              <option
                value="All Weeks"
                style={
                  selectedWeek === "All Weeks" ? { color: "white", fontWeight: "bold" } : {}
                }
              >
                All Weeks
              </option>
              {availableWeeks.map((wk) => (
                <option
                  key={wk}
                  value={wk}
                  style={selectedWeek === wk ? { color: "white", fontWeight: "bold" } : {}}
                >
                  {wk}
                </option>
              ))}
            </Select>
            {/* Additional button to reset to all weeks */}
            <Button colorScheme="teal" size="sm" onClick={showAllWeeks}>
              All Weeks
            </Button>
          </Flex>
        </Flex>

        {/* Metrics Grid */}
        <Grid
          templateColumns={{
            base: "repeat(1, 1fr)",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            lg: "repeat(5, 1fr)",
          }}
          gap={4}
          width="100%"
          overflowX="auto"
        >
          {METRICS.map((metric) => {
            const pts = plotlySeries[metric] || [];

            // Single trace
            const trace = {
              x: pts.map((p) => p.date),
              y: pts.map((p) => p.value),
              type: "scatter",
              mode: "lines+markers",
              line: {
                color: "#00FFFF", // Bright cyan
                width: 2,
                shape: "linear",
              },
              marker: {
                size: 6,
                color: "#00FFFF",
              },
              name: "All", // Hover says “All”
              hovertemplate: `
                <b>All</b><br>
                <b>Date:</b> %{x|%b %d}<br>
                <b>Value:</b> %{y} ${METRIC_UNITS[metric]}<extra></extra>
              `,
              connectgaps: true,
            };

            // Performance color
            const avgVal = parseFloat(averages[metric]);
            let performance = "Poor";
            if (!isNaN(avgVal)) {
              if (avgVal <= THRESHOLDS[metric].good) {
                performance = "Good";
              } else if (avgVal <= THRESHOLDS[metric].needsImprovement) {
                performance = "Needs Improvement";
              }
            }
            const performanceColor =
              performance === "Good"
                ? "green.400"
                : performance === "Needs Improvement"
                ? "yellow.400"
                : "red.400";

            // Current date line
            const { shapes, annotations } = getCurrentDateLine(mostRecentDate);

            return (
              <Tooltip
                key={metric}
                label={
                  <>
                    <Text fontWeight="bold">{metric} Performance:</Text>
                    <Text>
                      Good: ≤ {formatNumber(THRESHOLDS[metric].good)}
                      {METRIC_UNITS[metric]}
                    </Text>
                    <Text>
                      Needs Improvement: ≤ {formatNumber(THRESHOLDS[metric].needsImprovement)}
                      {METRIC_UNITS[metric]}
                    </Text>
                    <Text>
                      Poor: &gt; {formatNumber(THRESHOLDS[metric].needsImprovement)}
                      {METRIC_UNITS[metric]}
                    </Text>
                    <Box mt={2}>
                      <Text fontWeight="bold">What is {metric}?</Text>
                      <Text fontSize="sm">{METRIC_DEFINITIONS[metric]}</Text>
                    </Box>
                  </>
                }
                bg="gray.700"
                color="white"
                fontSize="sm"
                placement="top"
                hasArrow
              >
                <Box
                  bg="transparent"
                  p={4}
                  transition="box-shadow 0.2s, transform 0.2s"
                  _hover={{ boxShadow: "lg", transform: "translateY(-4px)" }}
                  cursor="pointer"
                  minW="140px"
                  minH="300px"
                  display="flex"
                  flexDirection="column"
                  justifyContent="space-between"
                  position="relative"
                >
                  <Flex direction="column" align="center">
                    {/* Title & Expand */}
                    <Flex width="100%" justifyContent="space-between" alignItems="center">
                      <Box
                        height="50px"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        textAlign="center"
                        flex="1"
                      >
                        <Text color="white" fontSize="sm" fontWeight="bold" isTruncated>
                          {metric}
                        </Text>
                      </Box>
                      <IconButton
                        aria-label="Expand Graph"
                        icon={<FaExpand />}
                        color="white"
                        bg="transparent"
                        _hover={{ bg: "transparent" }}
                        size="sm"
                        onClick={() => handleExpand([trace], metric)}
                      />
                    </Flex>

                    {/* Average & Performance */}
                    <Flex direction="column" justify="center" align="center" mt={2}>
                      <Text color="white" fontSize="2xl" fontWeight="bold" textAlign="center">
                        {formatNumber(averages[metric])}
                      </Text>
                      <Text color={performanceColor} fontSize="sm" fontWeight="bold" mt={1}>
                        {performance}
                      </Text>
                    </Flex>
                  </Flex>

                  {/* Plotly Graph */}
                  <Box mt={4} width="100%" height="150px" position="relative">
                    <Plot
                      data={[trace]}
                      layout={{
                        autosize: true,
                        margin: { l: 40, r: 10, t: 10, b: 30 },
                        xaxis: {
                          tickfont: { size: 10, color: "white" },
                          type: "date",
                          showgrid: false,
                          zeroline: false,
                          showline: false,
                          ticks: "",
                          tickformat: "%b %d",
                          dtick: "M1",
                          showticklabels: true,
                        },
                        yaxis: {
                          tickfont: { size: 10, color: "white" },
                          showgrid: false,
                          zeroline: false,
                          showline: false,
                          ticks: "",
                          showticklabels: true,
                          title: { text: "" },
                        },
                        shapes: shapes,
                        annotations: annotations,
                        showlegend: false,
                        hovermode: "closest",
                        paper_bgcolor: "transparent",
                        plot_bgcolor: "transparent",
                      }}
                      config={{
                        displayModeBar: false,
                        responsive: true,
                        hovermode: "closest",
                      }}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </Box>
                </Box>
              </Tooltip>
            );
          })}
        </Grid>
      </Flex>

      {/* Expanded Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent bg="gray.800" color="white" border="2.5px solid" borderColor="gray.300">
          <ModalHeader>{modalMetric}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {modalPlotData && (
              <Plot
                data={modalPlotData}
                layout={{
                  autosize: true,
                  margin: { l: 50, r: 50, t: 50, b: 50 },
                  xaxis: {
                    type: "date",
                    title: "Date",
                    tickformat: "%B %d, %Y",
                    dtick: "M1",
                    showticklabels: true,
                    tickfont: { size: 12, color: "white" },
                  },
                  yaxis: {
                    tickfont: { size: 12, color: "white" },
                    showgrid: true,
                    zeroline: false,
                    showline: false,
                    ticks: "",
                    showticklabels: true,
                    title: { text: "" },
                  },
                  showlegend: false,
                  hovermode: "closest",
                  paper_bgcolor: "transparent",
                  plot_bgcolor: "transparent",
                }}
                config={{
                  displayModeBar: true,
                  responsive: true,
                  hovermode: "closest",
                }}
                style={{ width: "100%", height: "500px" }}
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default PerformanceMapLocal;
