import { useEffect, useMemo, useState } from "react";
import BarChart from "../components/comparison-chart";
import { ComparisonData, getAverageData, ResData } from "../data";
import {
    getLocalQuarterlyData,
    LocalQuarterData,
    getLocalAverageData
} from "../data/local_data_api_calls.ts";
import { SimpleGrid } from "@chakra-ui/react";

import AnimateNumber from "../components/animate-number";
import PerformanceMap from "../components/PerformanceMap";
import Heatmap from "../view/Heatmap";
import ComparisonNoGroup from "../components/comparison-chart-ungroup.tsx";
import { ExpandWrapper } from "../components/expand-wrapper.tsx";
import General from "../view/General.jsx";
import { fetchLocalPlotData } from "../api/generalPlotService";
import { LOCAL_SITES } from "../data/all_sites.js";
import DateDisplay from "../components/common/DateDisplay";
import useSelectedData from "../hooks/useSelectedData";
import LocalAverageChart from "../components/local-average-chart.jsx";
import {changeLabel} from "../utils/utils.js"

export const LocalOverview = () => {
    const [data, setData] = useState<{
        weekly: ResData;
        comparison: ComparisonData;
        quarterData: LocalQuarterData[];
        yearData: LocalQuarterData[];
        allTimeData?: LocalQuarterData;
        weekComparison: LocalQuarterData[];
    }>({
        quarterData: [],
        yearData: [],
        weekComparison: [],
        weekly: {
            changes: [],
            data: []
        },
        comparison: {
            notes: [],
            total: [],
            videos: [],
            insights: {
                notes: {
                    competition: "",
                    self: ""
                },
                total: {
                    competition: "",
                    self: ""
                },
                videos: {
                    competition: "",
                    self: ""
                }
            }
        }
    });

    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [localAverageData, averageData, localQuarterlyData] =
                    await Promise.all([
                        getLocalAverageData(),
                        getAverageData(),
                        getLocalQuarterlyData()
                    ]);

                setData((old) => ({
                    ...old,
                    ...localAverageData, // Merge amp average data
                    weekly: {
                        data: [
                            ...changeLabel(averageData.weekly.data, 'TV Azteca', 'General Azteca'),
                            ...changeLabel(localAverageData.weekly.data, 'TV Azteca', 'Local Azteca'),
                        ],
                        changes: [
                            ...changeLabel(averageData.weekly.changes, 'TV Azteca', 'General Azteca'),
                            ...changeLabel(localAverageData.weekly.changes, 'TV Azteca', 'Local Azteca'),
                        ]
                    },
                    quarterData: localQuarterlyData.quarter, 
                    yearData: localQuarterlyData.year,
                    allTimeData: localQuarterlyData.all_time, 
                    weekComparison: localQuarterlyData.week 
                }));
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, []);

    const [isAzteca] = useState<[boolean, boolean, boolean]>([
        true,
        true,
        true
    ]);

    const { 
        selectedData: currentQuarter, 
        setCurrentRecordIndex,
        topbarMode,
        currentRecordIndex,
        selectedFilterRecordsLength,
        changeTopbarMode
    } = useSelectedData(data);

    const combinedData = useMemo(() => {
        if (
            currentQuarter?.azteca?.length > 0 &&
            currentQuarter?.competition?.length > 0
        ) {
            return [...currentQuarter.azteca, ...currentQuarter.competition];
        }
        return [];
    }, [currentQuarter]);
    const [monthWeek, setMonthWeek] = useState<[number[], number[]]>([
        [0],
        [0]
    ]);
    return (
        <div className="main">
            <DateDisplay currentRecordIndex={currentRecordIndex} setCurrentRecordIndex={setCurrentRecordIndex} totalLength={selectedFilterRecordsLength} date={currentQuarter?.Date} />
            {/* Row 1 */}
            <div className="d-flex top-row text-white custom-row">
                {/* General */}
                <div className="box pt-2 px-3 ">
                    <div className="d-flex align-items-center justify-content-between">
                        <div className="title">General</div>
                        <div className="toggles d-flex align-items-center">
                            {/* <RadioGroup
                className="d-flex align-items-center"
                style={{ gap: "5px" }}
                value={isAzteca[0].toString()}
                onChange={(e) =>
                  setIsAzteca((old) => {
                    const newVal = [...old] as typeof isAzteca;
                    newVal[0] = e === "true";
                    return newVal;
                  })
                }
              >
                <div className="toggle-container d-flex align-items-center">
                  <Radio
                    isChecked={isAzteca[0]}
                    value={true.toString()}
                    style={{ marginBottom: "0" }}
                    size="sm"
                  >
                    TV Azteca
                  </Radio>
                </div>
                <div className="toggle-container d-flex align-items-center">
                  <Radio
                    value={false.toString()}
                    id="toggle-b"
                    style={{ marginBottom: "0" }}
                    size="sm"
                  >
                    Competition
                  </Radio>
                </div>
              </RadioGroup> */}
                        </div>
                    </div>
                    <div className="d-flex justify-content-center align-items-center percentage">
                        <AnimateNumber
                            number={
                                isAzteca[0]
                                    ? currentQuarter?.["TV Azteca Avg"]
                                    : currentQuarter?.["Competition Change"]
                            }
                        />
                        %
                    </div>
                    <div
                        className={`d-flex justify-content-center align-items-center percentage-change ${
                            ((isAzteca[0]
                                ? currentQuarter?.["TV Azteca Change"]
                                : currentQuarter?.["Competition Change"]) ||
                                1) > 0
                                ? "text-green"
                                : "text-red"
                        }`}
                    >
                        <span className="arrow">
                            {((isAzteca[0]
                                ? currentQuarter?.["TV Azteca Change"]
                                : currentQuarter?.["Competition Change"]) ||
                                1) > 0 ? (
                                <>&uarr;</>
                            ) : (
                                <>&darr;</>
                            )}
                        </span>

                        <span>
                            <AnimateNumber
                                number={
                                    isAzteca[0]
                                        ? currentQuarter?.["TV Azteca Change"]
                                        : currentQuarter?.["Competition Change"]
                                }
                            />
                            %
                        </span>
                    </div>
                    <div className="d-flex justify-content-center align-items-center vs-quarter text-green">
                        vs previous&nbsp;{" "}
                        <span
                            onClick={changeTopbarMode}
                            style={{
                                cursor: "pointer",
                                textDecoration: "underline"
                            }}
                        >
                            {topbarMode}
                        </span>
                    </div>
                    <div
                        style={
                            isOpen
                                ? {
                                      marginTop: "1rem",
                                      transitionDuration: "250ms"
                                  }
                                : {
                                      height: "0",
                                      overflow: "hidden"
                                  }
                        }
                    >
                        {combinedData?.map((company) => (
                            <div
                                key={company.name}
                                style={{
                                    paddingLeft: "20%",
                                    fontSize: "16px",
                                    marginBottom: "0.75rem"
                                }}
                            >
                                <span
                                    style={{
                                        fontWeight: "bold",
                                        fontSize: "16px"
                                    }}
                                >
                                    {company.name.replace("Azteca ", "")}:
                                </span>{" "}
                                {company.total.toFixed?.(0) || 0}%{" "}
                                <span
                                    className={`${
                                        company.total_change < 0
                                            ? "text-red"
                                            : "text-green"
                                    }`}
                                    style={{
                                        fontSize: "14px"
                                    }}
                                >
                                    ({company.total_change.toFixed?.(1) || 0}%)
                                </span>
                            </div>
                        ))}
                    </div>
                    <p
                        className="text-center"
                        style={{
                            display: "flex",
                            marginBottom: "0",
                            // marginTop: "1rem",
                            marginTop: "auto"
                        }}
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        <span
                            style={{
                                padding: "0.75rem",
                                cursor: "pointer",
                                marginLeft: "auto",
                                marginRight: "auto",
                                transform: `rotate(${isOpen ? 180 : 0}deg)`,
                                transitionDuration: "250ms"
                            }}
                        >
                            <img
                                src={"/down.png"}
                                style={{
                                    width: "20px",
                                    opacity: "1"
                                }}
                            />
                        </span>
                    </p>
                </div>

                {/* Nota */}
                <div className="box pt-2 px-3 ">
                    <div className="d-flex align-items-center justify-content-between">
                        <div className="title">Nota</div>
                        <div className="toggles d-flex align-items-center">
                            {/* <RadioGroup
                className="d-flex align-items-center"
                style={{ gap: "5px" }}
                value={isAzteca[1].toString()}
                onChange={(e) =>
                  setIsAzteca((old) => {
                    const newVal = [...old] as typeof isAzteca;
                    newVal[1] = e === "true";
                    return newVal;
                  })
                }
              >
                <div className="toggle-container d-flex align-items-center">
                  <Radio
                    isChecked={isAzteca[1]}
                    value={true.toString()}
                    style={{ marginBottom: "0" }}
                    size="sm"
                  >
                    Azteca
                  </Radio>
                </div>
                <div className="toggle-container d-flex align-items-center">
                  <Radio
                    value={false.toString()}
                    id="toggle-b"
                    style={{ marginBottom: "0" }}
                    size="sm"
                  >
                    Competition
                  </Radio>
                </div>
              </RadioGroup> */}
                        </div>
                    </div>
                    <div className="d-flex justify-content-center align-items-center percentage">
                        <AnimateNumber
                            number={
                                isAzteca[1]
                                    ? currentQuarter?.["TV Azteca Note Avg"]
                                    : currentQuarter?.["Competition Note Avg"]
                            }
                        />
                        %
                    </div>
                    <div
                        className={`d-flex justify-content-center align-items-center percentage-change ${
                            ((isAzteca[1]
                                ? currentQuarter?.["TV Azteca Note Avg"]
                                : currentQuarter?.["Competition Note Avg"]) ||
                                1) > 0
                                ? "text-green"
                                : "text-red"
                        }`}
                    >
                        <span className="arrow">
                            {((isAzteca[1]
                                ? currentQuarter?.["TV Azteca Note Avg"]
                                : currentQuarter?.["Competition Note Avg"]) ||
                                1) > 0 ? (
                                <>&uarr;</>
                            ) : (
                                <>&darr;</>
                            )}
                        </span>
                        <span>
                            {" "}
                            <AnimateNumber
                                number={
                                    isAzteca[1]
                                        ? currentQuarter?.[
                                              "TV Azteca Note Change"
                                          ]
                                        : currentQuarter?.[
                                              "Competition Note Change"
                                          ]
                                }
                            />
                            %
                        </span>
                    </div>
                    <div className="d-flex justify-content-center align-items-center vs-quarter text-green">
                        vs previous&nbsp;{" "}
                        <span
                            onClick={changeTopbarMode}
                            style={{
                                cursor: "pointer",
                                textDecoration: "underline"
                            }}
                        >
                            {topbarMode}
                        </span>
                    </div>
                    <div
                        style={
                            isOpen
                                ? {
                                      marginTop: "1rem",
                                      transitionDuration: "250ms"
                                  }
                                : {
                                      height: "0",
                                      overflow: "hidden"
                                  }
                        }
                    >
                        {combinedData?.map((company) => (
                            <div
                                style={{
                                    paddingLeft: "20%",
                                    fontSize: "16px",
                                    marginBottom: "0.75rem"
                                }}
                            >
                                <span
                                    style={{
                                        fontWeight: "bold",
                                        fontSize: "16px"
                                    }}
                                >
                                    {company.name.replace("Azteca ", "")}:
                                </span>{" "}
                                {company.note.toFixed?.(0) || 0}%{" "}
                                <span
                                    className={`${
                                        company.note_change < 0
                                            ? "text-red"
                                            : "text-green"
                                    }`}
                                    style={{
                                        fontSize: "14px"
                                    }}
                                >
                                    ({company.note_change.toFixed?.(1) || 0}%)
                                </span>
                            </div>
                        ))}
                    </div>
                    <p
                        className="text-center"
                        style={{
                            display: "flex",
                            marginBottom: "0",
                            marginTop: "auto"
                        }}
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        <span
                            style={{
                                padding: "0.75rem",
                                cursor: "pointer",
                                marginLeft: "auto",
                                marginRight: "auto",
                                transform: `rotate(${isOpen ? 180 : 0}deg)`,
                                transitionDuration: "250ms"
                            }}
                        >
                            <img
                                src={"/down.png"}
                                style={{
                                    width: "20px",
                                    opacity: "1"
                                }}
                            />
                        </span>
                    </p>
                </div>

                {/* Vide0 */}
                <div className="box pt-2 px-3 ">
                    <div className="d-flex align-items-center justify-content-between">
                        <div className="title">Video</div>

                        <div className="toggles d-flex align-items-center">
                            {/* <RadioGroup
                className="d-flex align-items-center"
                style={{ gap: "5px" }}
                value={isAzteca[2].toString()}
                onChange={(e) =>
                  setIsAzteca((old) => {
                    const newVal = [...old] as typeof isAzteca;
                    newVal[2] = e === "true";
                    return newVal;
                  })
                }
              >
                <div className="toggle-container d-flex align-items-center">
                  <Radio
                    isChecked={isAzteca[2]}
                    value={true.toString()}
                    style={{ marginBottom: "0" }}
                    size="sm"
                  >
                    Azteca
                  </Radio>
                </div>

                <div className="toggle-container d-flex align-items-center">
                  <Radio
                    value={false.toString()}
                    id="toggle-b"
                    style={{ marginBottom: "0" }}
                    size="sm"
                  >
                    Competition
                  </Radio>
                </div>
              </RadioGroup> */}
                        </div>
                    </div>

                    <div className="d-flex justify-content-center align-items-center percentage">
                        <AnimateNumber
                            number={
                                isAzteca[2]
                                    ? currentQuarter?.["TV Azteca Video Avg"]
                                    : currentQuarter?.["Competition Video Avg"]
                            }
                        />
                        %
                    </div>

                    <div
                        className={`d-flex justify-content-center align-items-center percentage-change ${
                            ((isAzteca[2]
                                ? currentQuarter?.["TV Azteca Video Change"]
                                : currentQuarter?.[
                                      "Competition Video Change"
                                  ]) || 1) > 0
                                ? "text-green"
                                : "text-red"
                        }`}
                    >
                        <span className="arrow">
                            {((isAzteca[2]
                                ? currentQuarter?.["TV Azteca Video Change"]
                                : currentQuarter?.[
                                      "Competition Video Change"
                                  ]) || 1) > 0 ? (
                                <>&uarr;</>
                            ) : (
                                <>&darr;</>
                            )}
                        </span>
                        <span>
                            <AnimateNumber
                                number={
                                    isAzteca[2]
                                        ? currentQuarter?.[
                                              "TV Azteca Video Change"
                                          ]
                                        : currentQuarter?.[
                                              "Competition Video Change"
                                          ]
                                }
                            />{" "}
                        </span>
                        %
                    </div>

                    <div className="d-flex justify-content-center align-items-center vs-quarter">
                        vs previous&nbsp;{" "}
                        <span
                            onClick={changeTopbarMode}
                            style={{
                                cursor: "pointer",
                                textDecoration: "underline"
                            }}
                        >
                            {topbarMode}
                        </span>
                    </div>

                    <div
                        style={
                            isOpen
                                ? {
                                      marginTop: "1rem",
                                      transitionDuration: "250ms"
                                  }
                                : {
                                      height: "0",
                                      overflow: "hidden"
                                  }
                        }
                    >
                        {combinedData?.map((company) => (
                            <div
                                key={company.name}
                                style={{
                                    paddingLeft: "20%",
                                    fontSize: "16px",
                                    marginBottom: "0.75rem"
                                }}
                            >
                                <span
                                    style={{
                                        fontWeight: "bold",
                                        fontSize: "16px"
                                    }}
                                >
                                    {company.name.replace("Azteca ", "")}:
                                </span>{" "}
                                {company.video.toFixed?.(0) || 0}%{" "}
                                <span
                                    className={`${
                                        company.video_change < 0
                                            ? "text-red"
                                            : "text-green"
                                    }`}
                                    style={{
                                        fontSize: "14px"
                                    }}
                                >
                                    ({company.video_change.toFixed?.(1) || 0}%)
                                </span>
                            </div>
                        ))}
                    </div>

                    <p
                        className="text-center"
                        style={{
                            display: "flex",
                            marginBottom: "0",
                            marginTop: "auto"
                        }}
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        <span
                            style={{
                                padding: "0.75rem",
                                cursor: "pointer",
                                marginLeft: "auto",
                                marginRight: "auto",
                                transform: `rotate(${isOpen ? 180 : 0}deg)`,
                                transitionDuration: "250ms"
                            }}
                        >
                            <img
                                src={"/down.png"}
                                style={{
                                    width: "20px",
                                    opacity: "1"
                                }}
                            />
                        </span>
                    </p>
                </div>
            </div>

            <div className="row custom-row mt-2 ">
                <div className="col-12">
                    <div className="box shadow mt-2">
                        <div id="line-adwords" className="">
                            <ExpandWrapper>
                                <LocalAverageChart data={data} />
                            </ExpandWrapper>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Row 2 */}
            <div className="row custom-row">
                <div className="col-12">
                    <SimpleGrid columns={[1, 2]} spacing={5}>
                        <section className="boxHeatmap">
                            <PerformanceMap
                                data={data}
                                month={monthWeek?.[0] || [0]}
                                week={monthWeek?.[1] || [0]}
                            />
                        </section>
                        <section className="box">
                            <Heatmap
                                data={data}
                                onCalculate={(month, week) => {
                                    console.log(
                                        "ASDLASDLAS:D FEFEFE",
                                        month,
                                        week,
                                        !monthWeek[0][0]
                                    );
                                    if (!monthWeek[0][0] && month[0]) {
                                        setMonthWeek([month, week]);
                                    }
                                }}
                            />
                        </section>
                    </SimpleGrid>
                </div>
            </div>

            {/* Row 3 */}
            <div className="row custom-row mt-2 ">
                <div className="col-12">
                    <div className="box shadow mt-2">
                        <div id="barchart">
                            <ExpandWrapper>
                                <BarChart
                                    data={data}
                                    titleHeading="Local Overview - TVA - Individual Bar Chart"
                                />
                            </ExpandWrapper>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 4 */}
            <div className="row custom-row mt-2 ">
                <div className="col-12">
                    <div className="box shadow mt-2">
                        <div id="barchart">
                            <ExpandWrapper>
                                <ComparisonNoGroup
                                    data={data}
                                    titleHeading="Local Overview - TVA - Week by Week Bar Chart"
                                />
                            </ExpandWrapper>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row custom-row mt-2 ">
                <div className="col-12">
                    <div className="box shadow mt-2">
                        <General
                            fetchData={fetchLocalPlotData}
                            groups={LOCAL_SITES}
                            preSelectedWebsites={"Laguna"}
                        />
                    </div>
                </div>
            </div>

        </div>
    );
};

export default LocalOverview;
