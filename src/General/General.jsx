// General.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
 Box,
 Text,
 Flex,
 Spinner,
 Button,
 Select,
 Grid,
 useToast,
 VStack,
 HStack,
 Checkbox,
 CheckboxGroup,
 IconButton,
 Popover,
 PopoverTrigger,
 PopoverContent,
 PopoverArrow,
 PopoverCloseButton,
 PopoverHeader,
 PopoverBody,
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
import { FaFilter, FaExpand } from "react-icons/fa"; // Importing FaFilter and FaExpand icons


// Import Plotly component
import Plot from "react-plotly.js";


// Helper function to parse "YYYY-MM-DD" to Date object
const parseDate = (dateStr) => {
 const [year, month, day] = dateStr.split("-").map(Number);
 return new Date(year, month - 1, day);
};


// Helper function to get the Monday of the week for a given date
const getWeekStartDate = (date) => {
 const day = date.getDay(); // Sunday - Saturday : 0 - 6
 const diff = day === 0 ? -6 : 1 - day; // Adjust when day is Sunday
 const monday = new Date(date);
 monday.setDate(date.getDate() + diff);
 // Format as "YYYY-MM-DD" with leading zeros
 const dd = String(monday.getDate()).padStart(2, "0");
 const mm = String(monday.getMonth() + 1).padStart(2, "0");
 const yyyy = monday.getFullYear();
 return `${yyyy}-${mm}-${dd}`;
};


// Helper function to format numbers: display without decimals if integer, else with one decimal
const formatNumber = (numStr) => {
 const num = parseFloat(numStr);
 if (isNaN(num)) return "N/A";
 return Number.isInteger(num) ? num.toString() : num.toFixed(1);
};


// Define the groups and their member companies
const GROUPS = {
 AMP: [
   "AZTECA UNO",
   "AZTECA 7",
   "DEPORTES",
   "ADN40",
   "NOTICIAS",
   "AZTECA VERACRUZ",
   "AZTECA QUINTANAROO",
   "AZTECA BC",
   "AZTECA SINALOA",
   "AZTECA CJ",
   "AZTECA AGUASCALIENTES",
   "AZTECA QUERETARO",
   "AZTECA CHIAPAS",
   "AZTECA PUEBLA",
   "AZTECA YUCATAN",
   "AZTECA CHIHUAHUA",
   "AZTECA MORELOS",
   "AZTECA JALISCO",
   "AZTECA GUERRERO",
   "AZTECA BAJIO",
 ],
};


// Extract group names and individual companies
const GROUP_NAMES = Object.keys(GROUPS);
const INDIVIDUAL_COMPANIES = GROUP_NAMES.reduce((acc, group) => acc.concat(GROUPS[group]), []);


// Define the metrics to display (ensure unique names and updated order)
const METRICS = [
 "First Contentful Paint",
 "Total Blocking Time",
 "Speed Index Performance",
 "Largest Contentful Paint",
 "Cumulative Layout Shift",
];


// Define units for each metric
const METRIC_UNITS = {
 "First Contentful Paint": "s",
 "Speed Index Performance": "s",
 "Total Blocking Time": "ms",
 "Largest Contentful Paint": "s",
 "Cumulative Layout Shift": "", // No unit
};


// Thresholds for performance metrics
const THRESHOLDS = {
 "First Contentful Paint": {
   good: 1.8,
   needsImprovement: 3.0,
 },
 "Speed Index Performance": {
   good: 3.4,
   needsImprovement: 5.8,
 },
 "Largest Contentful Paint": {
   good: 2.5,
   needsImprovement: 4.0,
 },
 "Total Blocking Time": {
   good: 200,
   needsImprovement: 600,
 },
 "Cumulative Layout Shift": {
   good: 0.1,
   needsImprovement: 0.25,
 },
};


// Ranges strings for tooltips
const RANGES_STRINGS = {
 "First Contentful Paint": "Good: 0–1.8 s, Needs Improvement: 1.8–3 s, Poor: Over 3 s",
 "Speed Index Performance": "Good: 0–3.4 s, Needs Improvement: 3.4–5.8 s, Poor: Over 5.8 s",
 "Largest Contentful Paint": "Good: 0–2.5 s, Needs Improvement: 2.5–4 s, Poor: Over 4 s",
 "Total Blocking Time": "Good: 0–200 ms, Needs Improvement: 200–600 ms, Poor: Over 600 ms",
 "Cumulative Layout Shift": "Good: 0–0.1, Needs Improvement: 0.1–0.25, Poor: Over 0.25",
};


// Mapping metrics to their corresponding keys in the data
const METRIC_KEYS = {
 "First Contentful Paint": "firstContentfulPaint",
 "Speed Index Performance": "speedIndex",
 "Total Blocking Time": "totalBlockingTime",
 "Largest Contentful Paint": "largestContentfulPaint",
 "Cumulative Layout Shift": "cumulativeLayoutShift",
};


// Helper function to calculate the slope of a linear regression
const calculateSlope = (x, y) => {
 const n = x.length;
 if (n === 0) return 0;


 const sum_x = x.reduce((a, b) => a + b, 0);
 const sum_y = y.reduce((a, b) => a + b, 0);
 const sum_xy = x.reduce((a, b, idx) => a + b * y[idx], 0);
 const sum_xx = x.reduce((a, b) => a + b * b, 0);


 const numerator = n * sum_xy - sum_x * sum_y;
 const denominator = n * sum_xx - sum_x * sum_x;


 if (denominator === 0) return 0;


 return numerator / denominator;
};


const General = () => {
 // State variables
 const [data, setData] = useState([]);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState(null);


 const [selectedCompany, setSelectedCompany] = useState("AMP"); // Preselect "AMP"
 const [selectedCategories, setSelectedCategories] = useState(["nota", "video"]);
 const [selectedWeek, setSelectedWeek] = useState("");
 const [availableWeeks, setAvailableWeeks] = useState([]);
 const [comparisonMode, setComparisonMode] = useState("Monthly"); // Preselect "Weekly"


 const toast = useToast();


 // Modal state for expanded graph
 const { isOpen, onOpen, onClose } = useDisclosure();
 const [modalPlotData, setModalPlotData] = useState(null);


 // Function to handle expand icon click
 const handleExpand = (plotData, metric) => {
   setModalPlotData({ ...plotData, metric });
   onOpen();
 };


 // Fetch and parse CSV data
 useEffect(() => {
   const csvUrl =
     "https://docs.google.com/spreadsheets/d/e/2PACX-1vRR1e59vIg3x_lmclndf5s2jhBsh_EqpgSKN-s-qGwlchOpPhh5SD2vScPzQ8dd4jWxDREafnpF81GC/pub?output=csv";


   Papa.parse(csvUrl, {
     download: true,
     header: false, // Parse without headers
     skipEmptyLines: true,
     complete: (results) => {
       try {
         console.log("Raw Parsed CSV Data:", results.data); // Debugging


         const parsedData = results.data.map((row, index) => {
           // Ensure the row has at least 8 columns
           if (row.length < 8) {
             throw new Error(`Row ${index + 1} has insufficient columns.`);
           }


           const dateObj = parseDate(row[0].trim());
           const weekStart = getWeekStartDate(dateObj);


           return {
             date: row[0].trim(), // Column A (YYYY-MM-DD)
             company: row[1].trim().toUpperCase(), // Column B (converted to uppercase)
             category: row[2].trim().toLowerCase(), // Column C
             firstContentfulPaint: row[3].trim(), // Column D
             totalBlockingTime: row[4].trim(), // Column E
             speedIndex: row[5].trim(), // Column F
             largestContentfulPaint: row[6].trim(), // Column G
             cumulativeLayoutShift: row[7].trim(), // Column H
             week: weekStart, // Added week information
           };
         });


         // Extract unique weeks and sort them
         const weeks = Array.from(new Set(parsedData.map((d) => d.week)));
         weeks.sort((a, b) => {
           const dateA = parseDate(a);
           const dateB = parseDate(b);
           return dateA - dateB;
         });


         console.log("Available Weeks:", weeks); // Debugging
         console.log("Parsed Data:", parsedData); // Debugging


         setAvailableWeeks(weeks);
         setData(parsedData);


         // Preselect the most recent week
         if (weeks.length > 0) {
           setSelectedWeek(weeks[weeks.length - 1]);
         }


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


 // Generate company options including groups and individual companies
 const companyOptions = useMemo(() => {
   const options = [];


   // Add group options
   GROUP_NAMES.forEach((group) => {
     options.push(
       <option key={group} value={group}>
         {group}
       </option>
     );
   });


   // Add individual company options
   INDIVIDUAL_COMPANIES.forEach((company) => {
     options.push(
       <option key={company} value={company}>
         {company}
       </option>
     );
   });


   return options;
 }, []);


 // Function to get the comparison date based on the selected date and comparison mode
 const getComparisonPeriod = useCallback((currentDateStr, mode) => {
   const currentDate = parseDate(currentDateStr);
   let comparisonDate;


   switch (mode) {
     case "Weekly":
       comparisonDate = new Date(currentDate);
       comparisonDate.setDate(currentDate.getDate() - 7);
       break;
     case "Monthly":
       comparisonDate = new Date(currentDate);
       comparisonDate.setMonth(currentDate.getMonth() - 1);
       break;
     case "Yearly":
       comparisonDate = new Date(currentDate);
       comparisonDate.setFullYear(currentDate.getFullYear() - 1);
       break;
     default:
       return null;
   }


   return comparisonDate;
 }, []);


 // Get the comparison date based on the selected week and comparison mode
 const comparisonDate = useMemo(() => {
   if (comparisonMode === "Weekly" || comparisonMode === "Monthly" || comparisonMode === "Yearly") {
     if (selectedWeek === "") return null;
     return getComparisonPeriod(selectedWeek, comparisonMode);
   }
   return null;
 }, [selectedWeek, comparisonMode, getComparisonPeriod]);


 // Memoized function to get filtered data
 const getFilteredData = useCallback(
   (dataSet, dateFilter) => {
     return dataSet.filter((row) => {
       // Company filtering
       let companyMatch = false;
       if (selectedCompany === "") {
         companyMatch = true; // No company selected
       } else if (GROUP_NAMES.includes(selectedCompany)) {
         // Group selected
         const groupCompanies = GROUPS[selectedCompany].map((c) => c.toUpperCase());
         companyMatch = groupCompanies.includes(row.company);
       } else {
         // Individual company selected
         companyMatch = row.company === selectedCompany.toUpperCase();
       }


       // Category filtering
       const categoryMatch =
         selectedCategories.length === 0 || selectedCategories.includes(row.category);


       // Time filtering
       let timeMatch = true;
       if (dateFilter) {
         const rowDate = parseDate(row.date);
         const filterDate = parseDate(dateFilter);


         if (comparisonMode === "Weekly") {
           // Filter by week
           timeMatch = row.week === dateFilter;
         } else if (comparisonMode === "Monthly") {
           // Filter by month
           timeMatch =
             rowDate.getFullYear() === filterDate.getFullYear() &&
             rowDate.getMonth() === filterDate.getMonth();
         } else if (comparisonMode === "Yearly") {
           // Filter by year
           timeMatch = rowDate.getFullYear() === filterDate.getFullYear();
         } else {
           // Default to no time filter
           timeMatch = true;
         }
       }


       return companyMatch && categoryMatch && timeMatch;
     });
   },
   [selectedCompany, selectedCategories, comparisonMode]
 );


 // Memoize the filtered data
 const filteredDataMemo = useMemo(() => {
   return getFilteredData(data, selectedWeek);
 }, [getFilteredData, data, selectedWeek]);


 // Filtered data for comparison
 const comparisonData = useMemo(() => {
   if (!comparisonDate) return [];


   let comparisonDateStr = "";
   if (comparisonMode === "Weekly") {
     comparisonDateStr = getWeekStartDate(comparisonDate);
   } else if (comparisonMode === "Monthly" || comparisonMode === "Yearly") {
     const yyyy = comparisonDate.getFullYear();
     const mm = String(comparisonDate.getMonth() + 1).padStart(2, "0");
     const dd = String(comparisonDate.getDate()).padStart(2, "0");
     comparisonDateStr = `${yyyy}-${mm}-${dd}`;
   }


   return getFilteredData(data, comparisonDateStr);
 }, [getFilteredData, data, comparisonDate, comparisonMode]);


 // Calculate averages for current data
 const averages = useMemo(() => {
   if (filteredDataMemo.length === 0) return {};


   const metricSums = {};
   METRICS.forEach((metric) => {
     metricSums[metric] = 0;
   });


   filteredDataMemo.forEach((row) => {
     METRICS.forEach((metric) => {
       const key = METRIC_KEYS[metric];
       const value = parseFloat(row[key]);
       if (!isNaN(value)) {
         metricSums[metric] += value;
       }
     });
   });


   const metricAverages = {};
   METRICS.forEach((metric) => {
     metricAverages[metric] = (metricSums[metric] / filteredDataMemo.length).toFixed(2);
   });


   console.log("Current Averages:", metricAverages); // Debugging
   return metricAverages;
 }, [filteredDataMemo]);


 // Calculate averages for comparison data
 const comparisonAverages = useMemo(() => {
   if (comparisonData.length === 0) return {};


   const metricSums = {};
   METRICS.forEach((metric) => {
     metricSums[metric] = 0;
   });


   comparisonData.forEach((row) => {
     METRICS.forEach((metric) => {
       const key = METRIC_KEYS[metric];
       const value = parseFloat(row[key]);
       if (!isNaN(value)) {
         metricSums[metric] += value;
       }
     });
   });


   const metricAverages = {};
   METRICS.forEach((metric) => {
     metricAverages[metric] = (metricSums[metric] / comparisonData.length).toFixed(2);
   });


   console.log("Comparison Averages:", metricAverages); // Debugging
   return metricAverages;
 }, [comparisonData]);


 // Calculate percentage differences
 const percentageDifferences = useMemo(() => {
   if (!comparisonDate) return {};


   const differences = {};


   METRICS.forEach((metric) => {
     const current = parseFloat(averages[metric]);
     const comparison = parseFloat(comparisonAverages[metric]);


     if (isNaN(current) || isNaN(comparison) || comparison === 0) {
       differences[metric] = "N/A";
     } else {
       // Calculate percentage difference and round to whole number
       const diff = ((current - comparison) / comparison) * 100;
       differences[metric] = Math.round(diff);
     }
   });


   console.log("Percentage Differences:", differences); // Debugging
   return differences;
 }, [averages, comparisonAverages, comparisonDate]);


 // Determine color based on percentage difference
 const getDifferenceColor = (metric) => {
   const diff = parseFloat(percentageDifferences[metric]);
   if (isNaN(diff)) return "gray.300"; // N/A


   // For metrics where lower is better
   if (diff < 0) {
     // Improvement
     return "green.400";
   } else if (diff > 0) {
     // Deterioration
     return "red.400";
   } else {
     return "gray.300"; // No change
   }
 };


 // Function to get performance color based on thresholds
 const getPerformanceColor = (metric, value) => {
   if (!THRESHOLDS[metric] || isNaN(value)) {
     return "gray.300"; // default color
   }


   const thresholds = THRESHOLDS[metric];


   if (value <= thresholds.good) {
     return "green.400";
   } else if (value <= thresholds.needsImprovement) {
     return "orange.400";
   } else {
     return "red.400";
   }
 };


 // Handle company selection
 const handleCompanyChange = (e) => {
   setSelectedCompany(e.target.value);
   // Removed setSelectedWeek to persist week selection
 };


 // Handle category selection
 const handleCategoryChange = (values) => {
   setSelectedCategories(values);
   // Removed setSelectedWeek to persist week selection
 };


 // Handle week selection
 const handleWeekChange = (e) => {
   setSelectedWeek(e.target.value);
   toast({
     title: "Week Selected",
     description: `Viewing data for the week starting on ${e.target.value}`,
     status: "success",
     duration: 3000,
     isClosable: true,
   });
 };


 // Reset week selection
 const resetWeekSelection = () => {
   setSelectedWeek("");
   toast({
     title: "Week Reset",
     description: "Viewing data without week filter.",
     status: "info",
     duration: 3000,
     isClosable: true,
   });
 };


 // Handle comparison mode selection
 const handleComparisonModeChange = (mode) => {
   setComparisonMode(mode);
   toast({
     title: `${mode} Comparison`,
     description: `Comparing to ${
       mode === "Weekly" ? "Last Week" : mode === "Monthly" ? "Last Month" : "Last Year"
     }.`,
     status: "info",
     duration: 3000,
     isClosable: true,
   });
 };


 // **Prepare data for Plotly graphs based on filtered data**
 const plotlyData = useMemo(() => {
   // Sort data by date
   const sortedData = [...filteredDataMemo].sort((a, b) => parseDate(a.date) - parseDate(b.date));


   // Check if multiple categories are selected
   const shouldAggregate = selectedCategories.length > 1;


   if (shouldAggregate || GROUP_NAMES.includes(selectedCompany)) {
     // Group data by date and compute average per metric
     const dataByDate = {};


     sortedData.forEach((row) => {
       if (!dataByDate[row.date]) {
         dataByDate[row.date] = { count: 0 };
         METRICS.forEach((metric) => {
           dataByDate[row.date][metric] = 0;
         });
       }
       dataByDate[row.date].count += 1;
       METRICS.forEach((metric) => {
         const key = METRIC_KEYS[metric];
         const value = parseFloat(row[key]);
         if (!isNaN(value)) {
           dataByDate[row.date][metric] += value;
         }
       });
     });


     // Compute averages
     const averagedData = Object.keys(dataByDate)
       .map((date) => {
         const obj = { date };
         METRICS.forEach((metric) => {
           obj[metric] = (dataByDate[date][metric] / dataByDate[date].count).toFixed(2) || 0;
         });
         return obj;
       })
       .sort((a, b) => parseDate(a.date) - parseDate(b.date));


     // Prepare plotly data
     return averagedData.map((row) => {
       const obj = { date: row.date };
       METRICS.forEach((metric) => {
         obj[metric] = parseFloat(row[metric]) || 0;
       });
       return obj;
     });
   } else {
     // Individual company or single category selected, use existing data
     return sortedData.map((row) => {
       const obj = { date: row.date };
       METRICS.forEach((metric) => {
         const key = METRIC_KEYS[metric];
         obj[metric] = parseFloat(row[key]) || 0;
       });
       return obj;
     });
   }
 }, [filteredDataMemo, selectedCategories, selectedCompany]);


 // **Determine the full date range for the filtered data**
 const dateRange = useMemo(() => {
   if (plotlyData.length === 0) return { min: null, max: null };
   const dates = plotlyData.map((d) => parseDate(d.date));
   const minDate = new Date(Math.min(...dates));
   const maxDate = new Date(Math.max(...dates));
   return { min: minDate, max: maxDate };
 }, [plotlyData]);


 // **Calculate trendline and determine color for each metric**
 const trendData = useMemo(() => {
   const trends = {};


   METRICS.forEach((metric) => {
     const plotDataPoints = plotlyData.map((d) => parseDate(d.date).getTime());
     const plotMetricValues = plotlyData.map((d) => d[metric]);


     const slope = calculateSlope(plotDataPoints, plotMetricValues);
     trends[metric] = slope;
   });


   return trends;
 }, [plotlyData]);


 return (
   <>
     {isLoading ? (
       <Flex justifyContent="center" alignItems="center" height="50vh">
         <Spinner size="xl" color="teal.500" />
         <Text ml={4} fontSize="xl">
           Loading data...
         </Text>
       </Flex>
     ) : error ? (
       <Text color="red.500" fontSize="xl" textAlign="center">
         {error}
       </Text>
     ) : (
       <Flex
         direction="column"
         gap={4} // Reduced gap to minimize empty space
         width="100%"
         maxW="1200px"
         align="center"
         bg="linear-gradient(90deg, #000000, #7800ff)" // Consistent background
         p={4} // Reduced padding to minimize empty space
         borderRadius="15px"
         border="2.5px solid"
         borderColor="gray.300" // Same border as panels
         mx="auto"
       >
         {/* Header Section */}
         <Flex
           width="100%"
           justifyContent="space-between"
           alignItems="center"
           flexWrap="wrap"
           gap={2} // Reduced gap
           bg="transparent" // Removed background
         >
           {/* Company Selector and Filter Icon */}
           <Flex alignItems="center" gap={2}>
             <Text color="white" fontSize="md" fontWeight="semibold">
               Company:
             </Text>
             <Select
               value={selectedCompany}
               onChange={handleCompanyChange}
               placeholder="Select Company"
               width="200px" // Reduced width if necessary
               bg="transparent" // Changed from "white" to "transparent"
               color="white" // Changed text color to white for readability
               borderRadius="md"
               size="sm" // Smaller size to reduce padding
               border="1px solid rgba(255, 255, 255, 0.6)" // Added semi-transparent white border
               _placeholder={{ color: "gray.300" }} // Placeholder color
               _focus={{ borderColor: "teal.300", boxShadow: "none" }} // Focus state
               _hover={{ borderColor: "teal.200" }} // Hover state
             >
               {companyOptions}
             </Select>


             {/* Filter Icon with Popover */}
             <Popover>
               <PopoverTrigger>
                 <IconButton
                   aria-label="Filter Controls"
                   icon={<FaFilter />}
                   color="white" // Make the icon white
                   bg="transparent"
                   _hover={{ bg: "gray.700" }}
                   size="sm" // Smaller size to reduce padding
                 />
               </PopoverTrigger>
               <PopoverContent bg="gray.800" border="none" boxShadow="lg" borderRadius="md">
                 <PopoverArrow bg="gray.800" />
                 <PopoverCloseButton color="white" />
                 <PopoverHeader color="white" fontWeight="bold">
                   Controls
                 </PopoverHeader>
                 <PopoverBody>
                   <VStack align="start" spacing={2}>
                     {/* Category Selection */}
                     <Box>
                       <Text fontSize="sm" fontWeight="semibold" mb={1}>
                         Category:
                       </Text>
                       <CheckboxGroup
                         colorScheme="teal"
                         value={selectedCategories}
                         onChange={handleCategoryChange}
                       >
                         <HStack spacing={2}>
                           <Checkbox
                             value="nota"
                             bg="transparent"
                             _checked={{
                               bg: "transparent",
                               color: "teal.300",
                               borderColor: "teal.300",
                             }}
                             size="sm" // Smaller size
                           >
                             Nota
                           </Checkbox>
                           <Checkbox
                             value="video"
                             bg="transparent"
                             _checked={{
                               bg: "transparent",
                               color: "teal.300",
                               borderColor: "teal.300",
                             }}
                             size="sm" // Smaller size
                           >
                             Video
                           </Checkbox>
                         </HStack>
                       </CheckboxGroup>
                     </Box>


                     {/* Week Filter */}
                     <Box>
                       <Text fontSize="sm" fontWeight="semibold" mb={1}>
                         Week:
                       </Text>
                       <Select
                         value={selectedWeek}
                         onChange={handleWeekChange}
                         placeholder="Select Week"
                         bg="transparent" // Changed from "white" to "transparent"
                         color="white" // Changed text color to white
                         borderRadius="md"
                         size="sm" // Smaller size
                         width="100%"
                         border="1px solid rgba(255, 255, 255, 0.6)" // Added semi-transparent white border
                         _placeholder={{ color: "gray.300" }} // Placeholder color
                         _focus={{ borderColor: "teal.300", boxShadow: "none" }} // Focus state
                         _hover={{ borderColor: "teal.200" }} // Hover state
                       >
                         {availableWeeks.map((week) => (
                           <option key={week} value={week}>
                             {week}
                           </option>
                         ))}
                       </Select>
                       {selectedWeek && (
                         <Button
                           colorScheme="red"
                           variant="outline"
                           size="xs" // Extra small size
                           onClick={resetWeekSelection}
                           mt={1} // Reduced top margin
                         >
                           Clear
                         </Button>
                       )}
                     </Box>


                     {/* Comparison Mode Selection */}
                     <Box>
                       <Text fontSize="sm" fontWeight="semibold" mb={1}>
                         Comparison Mode:
                       </Text>
                       <HStack spacing={2}>
                         <Button
                           colorScheme={comparisonMode === "Weekly" ? "teal" : "gray"}
                           onClick={() => handleComparisonModeChange("Weekly")}
                           size="xs" // Extra small size
                         >
                           Weekly
                         </Button>
                         <Button
                           colorScheme={comparisonMode === "Monthly" ? "teal" : "gray"}
                           onClick={() => handleComparisonModeChange("Monthly")}
                           size="xs" // Extra small size
                         >
                           Monthly
                         </Button>
                         <Button
                           colorScheme={comparisonMode === "Yearly" ? "teal" : "gray"}
                           onClick={() => handleComparisonModeChange("Yearly")}
                           size="xs" // Extra small size
                         >
                           Yearly
                         </Button>
                       </HStack>
                     </Box>
                   </VStack>
                 </PopoverBody>
               </PopoverContent>
             </Popover>
           </Flex>
         </Flex>


         {/* Metrics Display */}
         <Grid
           templateColumns={{
             base: "repeat(1, 1fr)", // 1 column on small screens
             sm: "repeat(2, 1fr)", // 2 columns on small to medium screens
             md: "repeat(3, 1fr)", // 3 columns on medium screens
             lg: "repeat(4, 1fr)", // 4 columns on large screens
             xl: "repeat(5, 1fr)", // 5 columns for 5 metrics
           }}
           gap={4} // Reduced gap for closer spacing
           width="100%"
           overflowX="auto" // Allow horizontal scrolling on smaller screens
         >
           {METRICS.map((metric) => {
             // Prepare Plotly data for individual or averaged graph
             const plotDataPoints = plotlyData.map((d) => d.date);
             const plotMetricValues = plotlyData.map((d) => d[metric]);


             // Calculate trendline slope
             const xValues = plotlyData.map((d) => parseDate(d.date).getTime());
             const yValues = plotMetricValues;
             const slope = calculateSlope(xValues, yValues);
             const lineColor = slope < 0 ? "green" : "red";


             const individualPlotData = {
               x: plotDataPoints,
               y: plotMetricValues,
               type: "scatter",
               mode: "lines+markers", // Keeps markers for hover points
               marker: {
                 color: "#82ca9d",
                 size: 6, // Adjust marker size as needed
               },
               line: {
                 color: lineColor, // Dynamic color based on trend
                 width: 2, // Reduced line width for less boldness
               },
               name: metric,
               // **Updated hovertemplate to show only full date and value**
               hovertemplate: "%{x|%B %d, %Y}<br>%{y}<extra></extra>",
             };


             return (
               <Tooltip
                 key={metric}
                 label={RANGES_STRINGS[metric]}
                 bg="gray.700"
                 color="white"
                 fontSize="sm"
                 placement="top"
                 hasArrow
               >
                 <Box
                   bg="transparent"
                   border="none"
                   borderRadius="lg"
                   p={4}
                   transition="box-shadow 0.2s, transform 0.2s"
                   _hover={{ boxShadow: "lg", transform: "translateY(-4px)" }}
                   cursor="pointer"
                   minW="140px"
                   minH="250px" // Increased height to accommodate y-axis
                   display="flex"
                   flexDirection="column"
                   justifyContent="space-between"
                   position="relative" // To position the expand icon
                 >
                   <Flex direction="column" align="center">
                     {/* Title and Expand Button Section */}
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
                       {/* Move Expand Button Here */}
                       <IconButton
                         aria-label="Expand Graph"
                         icon={<FaExpand />}
                         color="white"
                         bg="transparent"
                         _hover={{ bg: "transparent" }}
                         size="sm"
                         onClick={() => handleExpand(individualPlotData, metric)}
                       />
                     </Flex>


                     {/* Number and Difference Section */}
                     <Flex direction="column" justify="center" align="center" mt={2}>
                       <Flex alignItems="center" justify="center">
                         <Text color="white" fontSize="2xl" fontWeight="bold" textAlign="center">
                           {formatNumber(averages[metric]) || "N/A"}{" "}
                           {/* Removed unit labels */}
                         </Text>
                         {/* Add circle indicating performance */}
                         <Box
                           w={3}
                           h={3}
                           bg={getPerformanceColor(metric, parseFloat(averages[metric]))}
                           borderRadius="50%"
                           ml={2}
                         />
                       </Flex>
                       {comparisonMode !== "Current" && (
                         <>
                           <Text
                             color={getDifferenceColor(metric)}
                             fontSize="sm"
                             fontWeight="bold"
                             mt={1}
                           >
                             {percentageDifferences[metric] !== "N/A"
                               ? `${Math.abs(percentageDifferences[metric])}% ${
                                   percentageDifferences[metric] < 0 ? "↑" : "↓"
                                 }`
                               : "N/A"}
                           </Text>
                           {percentageDifferences[metric] !== "N/A" && (
                             <Text color="gray.300" fontSize="sm" mt={0.5}>
                               {comparisonMode === "Weekly"
                                 ? "vs Last Week"
                                 : comparisonMode === "Monthly"
                                 ? "vs Last Month"
                                 : "vs Last Year"}
                             </Text>
                           )}
                         </>
                       )}
                     </Flex>
                   </Flex>


                   {/* Graph Section */}
                   <Box
                     mt={4} // Increased margin-top for more space between labels and graph
                     width="100%"
                     height="150px" // Reduced height to allow more space below
                     position="relative"
                     className="plot-container"
                   >
                     <Box className="plot-container" position="relative" height="100%" width="100%">
                       <Plot
                         data={[individualPlotData]}
                         layout={{
                           autosize: true,
                           margin: { l: 40, r: 10, t: 10, b: 30 }, // Adjusted margins
                           xaxis: {
                             tickfont: { size: 10, color: "white" }, // Set x-axis numbers to white
                             type: "date",
                             showgrid: false,
                             zeroline: false,
                             showline: false,
                             ticks: "",
                             tickformat: "%b", // Display abbreviated month names
                             dtick: "M1", // Tick every month
                             showticklabels: true,
                           },
                           yaxis: {
                             tickfont: { size: 10, color: "white" }, // Set y-axis numbers to white
                             showgrid: false,
                             zeroline: false,
                             showline: false,
                             ticks: "",
                             showticklabels: true,
                             // Removed y-axis title
                             title: {
                               text: "", // No title
                             },
                           },
                           showlegend: false,
                           hovermode: "closest", // Ensures hover on closest point
                           paper_bgcolor: "transparent",
                           plot_bgcolor: "transparent",
                         }}
                         config={{
                           displayModeBar: false,
                           responsive: true,
                           hovermode: "closest", // Ensures hover on closest point
                         }}
                         style={{ width: "100%", height: "100%" }}
                       />
                     </Box>
                   </Box>
                 </Box>
               </Tooltip>
             );
           })}
         </Grid>


         {/* Modal for Expanded Graph */}
         <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
           <ModalOverlay />
           <ModalContent bg="gray.800" color="white">
             <ModalHeader>{modalPlotData ? modalPlotData.metric : "Expanded Graph"}</ModalHeader>
             <ModalCloseButton />
             <ModalBody>
               {modalPlotData && (
                 <Plot
                   data={[modalPlotData]}
                   layout={{
                     autosize: true,
                     margin: { l: 50, r: 50, t: 50, b: 50 },
                     xaxis: {
                       tickfont: { size: 12, color: "white" }, // Set x-axis numbers to white
                       type: "date",
                       title: "Date",
                       titlefont: { size: 14, color: "white" },
                       // **Updated tickformat to full date format**
                       tickformat: "%B %d, %Y", // Displays as "October 5, 2024"
                       dtick: "M1", // Tick every month
                       showticklabels: true,
                     },
                     yaxis: {
                       tickfont: { size: 12, color: "white" }, // Set y-axis numbers to white
                       showgrid: true, // Optionally show grid in modal
                       zeroline: false,
                       showline: false,
                       ticks: "",
                       showticklabels: true,
                       title: {
                         text: "", // No title
                       },
                     },
                     showlegend: false,
                     hovermode: "closest", // Ensures hover on closest point
                     paper_bgcolor: "transparent",
                     plot_bgcolor: "transparent",
                   }}
                   config={{
                     displayModeBar: true, // Enable mode bar in modal
                     responsive: true,
                     hovermode: "closest", // Ensures hover on closest point
                   }}
                   // **Updated hovertemplate to show only full date and value**
                   data={[
                     {
                       ...modalPlotData,
                       hovertemplate: "%{x|%B %d, %Y}<br>%{y}<extra></extra>",
                     },
                   ]}
                   style={{ width: "100%", height: "100%" }}
                 />
               )}
             </ModalBody>
           </ModalContent>
         </Modal>
       </Flex>
     )}
   </>
 );
};


export default General;



