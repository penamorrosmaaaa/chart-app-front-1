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
} from "@chakra-ui/react";
import Papa from "papaparse";
import { FaExpand } from "react-icons/fa";
import Plot from "react-plotly.js";

// Helper: parse "YYYY-MM-DD" to a Date object
const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
};

// Helper: "YYYY-MM-DD" range to "MMM DD, YYYY - MMM DD, YYYY"
const formatDateRange = (start, end) => {
    if (!start || !end) return "N/A";
    const startDate = parseDate(start);
    const endDate = parseDate(end);
    const options = { month: "short", day: "numeric", year: "numeric" };
    return `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(
        undefined,
        options
    )}`;
};

// Helper: format number with or without decimals
const formatNumber = (numStr) => {
    const num = parseFloat(numStr);
    if (isNaN(num)) return "N/A";
    return Number.isInteger(num) ? num.toString() : num.toFixed(1);
};

// Company-to-URL
const COMPANY_URLS = {
    Milenio: "https://www.milenio.com/",
    "El Heraldo": "https://heraldodemexico.com.mx/",
    "El Universal": "https://www.eluniversal.com.mx/",
    Televisa: "https://www.televisa.com/",
    Terra: "https://www.terra.com.mx/",
    AS: "https://mexico.as.com/",
    Infobae: "https://www.infobae.com/mexico/",
    "NY Times": "https://www.nytimes.com/",
    "TV Azteca": "https://www.tvazteca.com/",
    deportes: "https://www.tvazteca.com/aztecadeportes/",
    "7": "https://www.tvazteca.com/azteca7/",
    noticias: "https://www.tvazteca.com/aztecanoticias/",
    adn40: "https://www.adn40.mx/",
    Amastv: "https://www.tvazteca.com/amastv/",
    Uno: "https://www.tvazteca.com/aztecauno/",
};

// Groups
const GROUPS = {
    "TV Azteca Companies": [
        "deportes",
        "7",
        "noticias",
        "adn40",
        "Amastv",
        "Uno",
    ],
    Competitors: [
        "Milenio",
        "El Heraldo",
        "El Universal",
        "Televisa",
        "Terra",
        "AS",
        "Infobae",
        "NY Times",
    ],
};

const GROUP_NAMES = Object.keys(GROUPS);
const INDIVIDUAL_COMPANIES = ["TV Azteca", ...Object.values(GROUPS).flat()];

// Metrics
const METRICS = ["LCP", "CLS", "INP", "FCP", "TTFB"];

// Short descriptions (hover tooltips)
const METRIC_DESCRIPTIONS = {
    LCP: "Largest Contentful Paint indicates how quickly the main content is visible.",
    CLS: "Cumulative Layout Shift measures the visual stability of the page load.",
    INP: "Interaction to Next Paint measures responsiveness to user input.",
    FCP: "First Contentful Paint measures how quickly the first text or image is painted.",
    TTFB: "Time to First Byte measures the time for a browser to receive the first byte of content.",
};

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

// Colors
const COLORS_TV_AZTECA = {
    phone: "#0000FF",   // Blue for phone
    desktop: "#87CEFA", // Light blue for desktop
};
const COLORS_COMPETITORS = {
    phone: "#FF0000",   // Red for phone
    desktop: "#FFA07A", // Light salmon for desktop
};

// Aggregation for groups
function getAggregatedGroupData(dataRows, metric, formFactor) {
    const mapByDate = {};
    dataRows.forEach((row) => {
        if (row.metric === metric && row.formFactor === formFactor) {
            const dateKey = row.endDate;
            if (!mapByDate[dateKey]) {
                mapByDate[dateKey] = [];
            }
            mapByDate[dateKey].push(row.p75);
        }
    });
    const aggregated = Object.keys(mapByDate).map((date) => {
        const sum = mapByDate[date].reduce((acc, val) => acc + val, 0);
        const avg = sum / mapByDate[date].length;
        return { date: date, value: avg };
    });
    aggregated.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    return aggregated;
}

// Single-company data
function getSingleCompanyData(dataRows, metric, formFactor) {
    return dataRows
        .filter((row) => row.metric === metric && row.formFactor === formFactor)
        .sort((a, b) => parseDate(a.endDate) - parseDate(b.endDate))
        .map((row) => ({ date: row.endDate, value: row.p75 }));
}

const PerformanceMapVertical = () => {
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Preselect TV Azteca
    const [selectedCompany, setSelectedCompany] = useState("TV Azteca Companies");

    // Example of a week-range selector
    const [selectedWeekRange, setSelectedWeekRange] = useState("all");

    // NEW: Select "phone" or "desktop"
    const [selectedFormFactor, setSelectedFormFactor] = useState("phone");

    const { isOpen, onOpen, onClose } = useDisclosure();
    const [modalPlotData, setModalPlotData] = useState(null);
    const [modalMetric, setModalMetric] = useState("");

    // Fetch CSV once
    useEffect(() => {
        const csvUrl =
            "https://docs.google.com/spreadsheets/d/e/2PACX-1vQkary38OmPhvyBG9ZgDkJbcZmP4Q0_qYVceNyQPDcrr0HERgtq2C46ImlSGnFL9Etfw4PaC9y0xcpL/pub?output=csv";
        Papa.parse(csvUrl, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const parsedData = results.data.map((row, idx) => ({
                        website: row["Website"] ? row["Website"].trim() : "",
                        formFactor: row["Form Factor"]
                            ? row["Form Factor"].trim().toLowerCase()
                            : "",
                        metric: row["Metric"] ? row["Metric"].trim().toUpperCase() : "",
                        p75: row["P75"] ? parseFloat(row["P75"]) : NaN,
                        startDate: row["Start Date"] ? row["Start Date"].trim() : "",
                        endDate: row["End Date"] ? row["End Date"].trim() : "",
                        weekRange:
                            row["Start Date"] && row["End Date"]
                                ? formatDateRange(
                                      row["Start Date"].trim(),
                                      row["End Date"].trim()
                                  )
                                : "N/A",
                    }));

                    const validData = parsedData.filter((row, i) => {
                        if (!row.website) {
                            console.warn(`Row ${i + 2} skipped: Missing 'Website'`);
                            return false;
                        }
                        if (!row.metric) {
                            console.warn(`Row ${i + 2} skipped: Missing 'Metric'`);
                            return false;
                        }
                        if (isNaN(row.p75)) {
                            console.warn(`Row ${i + 2} skipped: Invalid 'P75' value`);
                            return false;
                        }
                        return true;
                    });
                    setData(validData);
                    setIsLoading(false);
                } catch (err) {
                    console.error("Error processing CSV data:", err);
                    setError(`Failed to process data: ${err.message}`);
                    setIsLoading(false);
                }
            },
            error: (err) => {
                console.error("Error fetching CSV data:", err);
                setError(`Failed to fetch data: ${err.message}`);
                setIsLoading(false);
            },
        });
    }, []);

    // Compute week-range options
    const weekOptions = useMemo(() => {
        const uniqueWeeks = [...new Set(data.map((d) => d.weekRange))].filter(
            (w) => w !== "N/A"
        );
        return ["all", ...uniqueWeeks];
    }, [data]);

    // Company options: Groups + Individuals
    const companyOptions = useMemo(() => {
        const options = [];
        GROUP_NAMES.forEach((group) => {
            options.push(
                <option key={group} value={group}>
                    {group}
                </option>
            );
        });
        INDIVIDUAL_COMPANIES.forEach((company) => {
            options.push(
                <option key={company} value={company}>
                    {company}
                </option>
            );
        });
        return options;
    }, []);

    // Filter data by company AND by selected week
    const filteredDataAllTime = useMemo(() => {
        if (!selectedCompany) return [];
        let filtered = data;

        if (selectedWeekRange !== "all") {
            filtered = filtered.filter((row) => row.weekRange === selectedWeekRange);
        }

        if (GROUP_NAMES.includes(selectedCompany)) {
            const groupCompanies = GROUPS[selectedCompany];
            const groupURLs = groupCompanies.map((c) => COMPANY_URLS[c]);
            return filtered.filter((row) => groupURLs.includes(row.website));
        } else {
            const url = COMPANY_URLS[selectedCompany];
            return filtered.filter((row) => row.website === url);
        }
    }, [data, selectedCompany, selectedWeekRange]);

    // Create a single trace for the selected formFactor
    const plotlyData = useMemo(() => {
        const dataByMetric = {};
        METRICS.forEach((metric) => {
            const series = GROUP_NAMES.includes(selectedCompany)
                ? getAggregatedGroupData(filteredDataAllTime, metric, selectedFormFactor)
                : getSingleCompanyData(filteredDataAllTime, metric, selectedFormFactor);

            dataByMetric[metric] = series;
        });
        return dataByMetric;
    }, [filteredDataAllTime, selectedCompany, selectedFormFactor]);

    // Overall average for each metric (only selected formFactor)
    const averages = useMemo(() => {
        if (!filteredDataAllTime.length) return {};
        const sums = {};
        const counts = {};
        METRICS.forEach((m) => {
            sums[m] = 0;
            counts[m] = 0;
        });
        filteredDataAllTime.forEach((row) => {
            if (
                METRICS.includes(row.metric) &&
                !isNaN(row.p75) &&
                row.formFactor === selectedFormFactor
            ) {
                sums[row.metric] += row.p75;
                counts[row.metric] += 1;
            }
        });
        const avgs = {};
        METRICS.forEach((m) => {
            avgs[m] = counts[m] ? (sums[m] / counts[m]).toFixed(2) : "N/A";
        });
        return avgs;
    }, [filteredDataAllTime, selectedFormFactor]);

    // Find most recent date among the filtered data
    const mostRecentDate = useMemo(() => {
        if (!filteredDataAllTime.length) return null;
        let maxDt = new Date(0);
        filteredDataAllTime.forEach((r) => {
            const d = parseDate(r.endDate);
            if (d > maxDt) {
                maxDt = d;
            }
        });
        return maxDt.getTime() === 0 ? null : maxDt;
    }, [filteredDataAllTime]);

    // Color logic
    const isAztecaSelection =
        selectedCompany === "TV Azteca" || selectedCompany === "TV Azteca Companies";
    const getColor = (isAzteca, formFactor) => {
        if (isAzteca) return COLORS_TV_AZTECA[formFactor];
        return COLORS_COMPETITORS[formFactor];
    };

    // Performance label: Good / Needs Improvement / Poor
    function getPerformanceCategory(metric, avgValue) {
        if (isNaN(avgValue)) return "Poor";
        const val = parseFloat(avgValue);
        if (val <= THRESHOLDS[metric].good) return "Good";
        if (val <= THRESHOLDS[metric].needsImprovement) return "Needs Improvement";
        return "Poor";
    }

    // Expand modal
    const handleExpand = (plotData, metric) => {
        setModalPlotData(plotData);
        setModalMetric(metric);
        onOpen();
    };

    // Mark current date line
    function getCurrentDateLineAndAnnotation(date) {
        if (!date) return {};
        const isoString = date.toISOString().split("T")[0]; // 'YYYY-MM-DD'
        return {
            shapes: [
                {
                    type: "line",
                    xref: "x",
                    yref: "paper",
                    x0: isoString,
                    x1: isoString,
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
                    x: isoString,
                    y: 1,
                    xref: "x",
                    yref: "paper",
                    text: "",
                    showarrow: true,
                    arrowhead: 2,
                    ax: 0,
                    ay: -40,
                    font: { color: "white" },
                },
            ],
        };
    }

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
        <Flex
            direction="column"
            gap={4}
            width="100%"
            maxW="1200px"
            align="center"
            p={4}
            borderRadius="15px"
            mx="auto"
            bg="transparent"
        >
            {/* Header: Company, Week, Form Factor */}
            <Flex
                width="100%"
                justifyContent="flex-start"
                alignItems="center"
                flexWrap="wrap"
                gap={4}
                bg="transparent"
            >
                {/* Grouping Company Selector */}
                <Flex alignItems="center" gap={2}>
                    <Text color="white" fontSize="md" fontWeight="semibold">
                        Company:
                    </Text>
                    <Select
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        placeholder="Select Company"
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

                {/* Grouping Week and Form Factor Selectors */}
                <Flex alignItems="center" gap={2}>
                    {/* Week Selector */}
                    <Text color="white" fontSize="md" fontWeight="semibold">
                        Week:
                    </Text>
                    <Select
                        value={selectedWeekRange}
                        onChange={(e) => setSelectedWeekRange(e.target.value)}
                        placeholder="All Weeks"
                        width="200px"
                        bg="transparent"
                        borderRadius="md"
                        border="1px solid rgba(255, 255, 255, 0.6)"
                        size="sm"
                        _placeholder={{ color: "gray.300" }}
                    >
                        {weekOptions.map((week) => (
                            <option key={week} value={week}>
                                {week}
                            </option>
                        ))}
                    </Select>

                    {/* Form Factor Selector */}
                    <Text color="white" fontSize="md" fontWeight="semibold">
                        Form Factor:
                    </Text>
                    <Select
                        value={selectedFormFactor}
                        onChange={(e) => setSelectedFormFactor(e.target.value)}
                        width="200px"
                        bg="transparent"
                        borderRadius="md"
                        border="1px solid rgba(255, 255, 255, 0.6)"
                        size="sm"
                    >
                        <option value="phone">Mobile</option>
                        <option value="desktop">Desktop</option>
                    </Select>
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
                    // Data for this metric & selected form factor
                    const seriesData = plotlyData[metric] || [];

                    // Single trace
                    const trace = {
                        x: seriesData.map((pt) => pt.date),
                        y: seriesData.map((pt) => pt.value),
                        type: "scatter",
                        mode: "lines+markers",
                        line: {
                            color: getColor(isAztecaSelection, selectedFormFactor),
                            width: 2,
                            shape: "linear",
                        },
                        marker: {
                            size: 6,
                            color: getColor(isAztecaSelection, selectedFormFactor),
                        },
                        name: selectedFormFactor === "phone"
                            ? "<b style='color:white;'>Mobile</b>"
                            : "<b style='color:white;'>Desktop</b>",
                        hovertemplate: `
                            <b>${selectedFormFactor === "phone" ? "Mobile" : "Desktop"}</b><br>
                            <b>Date:</b> %{x|%b %d}<br>
                            <b>Value:</b> %{y} ${METRIC_UNITS[metric]}<extra></extra>
                        `,
                        connectgaps: true,
                    };

                    // Performance label
                    const avgVal = parseFloat(averages[metric] || "NaN");
                    const performance = getPerformanceCategory(metric, avgVal);
                    const performanceColor =
                        performance === "Good"
                            ? "green.400"
                            : performance === "Needs Improvement"
                            ? "yellow.400"
                            : "red.400";

                    // Mark current date
                    const { shapes, annotations } = getCurrentDateLineAndAnnotation(mostRecentDate);

                    return (
                        <Tooltip
                            key={metric}
                            label={
                                <>
                                    <Text fontWeight="bold">{metric} Performance:</Text>
                                    <Text>{METRIC_DESCRIPTIONS[metric]}</Text>
                                    <Text>
                                        Good: ≤ {formatNumber(THRESHOLDS[metric].good)}
                                        {METRIC_UNITS[metric]}
                                    </Text>
                                    <Text>
                                        Needs Improvement: ≤{" "}
                                        {formatNumber(THRESHOLDS[metric].needsImprovement)}
                                        {METRIC_UNITS[metric]}
                                    </Text>
                                    <Text>
                                        Poor: &gt;{" "}
                                        {formatNumber(THRESHOLDS[metric].needsImprovement)}
                                        {METRIC_UNITS[metric]}
                                    </Text>
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
                                    <Flex
                                        width="100%"
                                        justifyContent="space-between"
                                        alignItems="center"
                                    >
                                        <Box
                                            height="50px"
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="center"
                                            textAlign="center"
                                            flex="1"
                                        >
                                            <Text
                                                color="white"
                                                fontSize="sm"
                                                fontWeight="bold"
                                                isTruncated
                                            >
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

                                    {/* Averages + Performance */}
                                    <Flex direction="column" justify="center" align="center" mt={2}>
                                        <Text
                                            color="white"
                                            fontSize="2xl"
                                            fontWeight="bold"
                                            textAlign="center"
                                        >
                                            {formatNumber(averages[metric])}
                                        </Text>
                                        <Text
                                            color={performanceColor}
                                            fontSize="sm"
                                            fontWeight="bold"
                                            mt={1}
                                        >
                                            {performance}
                                        </Text>
                                    </Flex>
                                </Flex>

                                {/* Graph */}
                                <Box
                                    mt={4}
                                    width="100%"
                                    height="150px"
                                    position="relative"
                                    className="plot-container"
                                >
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
                                            shapes: shapes || [],
                                            annotations: annotations || [],
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

            {/* Modal for expanded graph */}
            <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
                <ModalOverlay />
                <ModalContent
                    bg="gray.800"
                    color="white"
                    border="2.5px solid"
                    borderColor="gray.300"
                >
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
                                        tickformat: "%b %d",
                                        dtick: "M1",
                                        showticklabels: true,
                                        titlefont: { size: 14, color: "white" },
                                        tickfont: { size: 12, color: "white" },
                                    },
                                    yaxis: {
                                        tickfont: { size: 12, color: "white" },
                                        showgrid: false,
                                        zeroline: false,
                                        showline: false,
                                        ticks: "",
                                        showticklabels: true,
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
        </Flex>
    );
};

export default PerformanceMapVertical;
