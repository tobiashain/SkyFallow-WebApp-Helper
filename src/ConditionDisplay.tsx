import React from "react";
import type { Condition } from "./types";
import "./ConditionDisplay.scss";

interface Props {
  condition: Condition | null | undefined;
}

export const ConditionDisplay: React.FC<Props> = ({ condition }) => {
  if (!condition)
    return <span className="condition-display__always">Always</span>;

  const { type } = condition;

  switch (type) {
    case "DayCondition":
      return (
        <span className="condition-display__leaf">
          Day = <strong>{condition.day}</strong>
        </span>
      );

    case "WeekdayCondition":
      return (
        <span className="condition-display__leaf">
          Weekday = <strong>{condition.weekday}</strong>
        </span>
      );

    case "FlagCondition":
      return (
        <span className="condition-display__leaf">
          Flag: <strong>{condition.flag_name}</strong>
        </span>
      );

    case "FriendshipCondition":
      return (
        <span className="condition-display__leaf">
          ❤️ <strong>{condition.npc_id}</strong> ≥ {condition.required_hearts}
        </span>
      );

    case "AndCondition":
    case "OrCondition": {
      const isAnd = type === "AndCondition";
      const blockClass = isAnd
        ? "condition-display--and"
        : "condition-display--or";
      return (
        <div className={`condition-display ${blockClass}`}>
          <span className="condition-display__label">
            {isAnd ? "AND" : "OR"}
          </span>
          <ul className="condition-display__list">
            {(condition.sub_conditions ?? []).map((sub, i) => (
              <li key={i} className="condition-display__item">
                <ConditionDisplay condition={sub} />
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case "NotCondition":
      return (
        <div className="condition-display condition-display--not">
          <span className="condition-display__label">NOT</span>
          <div className="condition-display__content">
            <ConditionDisplay condition={condition.condition} />
          </div>
        </div>
      );

    default:
      return (
        <span className="condition-display__unknown">Unknown: {type}</span>
      );
  }
};
