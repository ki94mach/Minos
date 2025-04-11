import React from "react";
import Select from "react-select";

interface OptionType {
    value: string;
    label: string;
}

interface DropdownProps {
    options: OptionType[];
    placeholder?: string;
    onChange: (selectedOption: OptionType | null) => void;
}

const Dropdown: React.FC<DropdownProps> = ({ options, placeholder, onChange }) => {
    return (
        <Select
            options={options}
            placeholder={placeholder}
            isClearable
            onChange={onChange}
        />
    );
};

export default Dropdown;
