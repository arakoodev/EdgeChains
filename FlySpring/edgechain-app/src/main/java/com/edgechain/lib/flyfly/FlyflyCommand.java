package com.edgechain.lib.flyfly;

import com.edgechain.lib.flyfly.commands.format.FormatCommand;
import com.edgechain.lib.flyfly.commands.jbang.JbangCommand;
import com.edgechain.lib.flyfly.commands.run.RunCommand;
import org.springframework.stereotype.Component;
import picocli.CommandLine;
import picocli.CommandLine.Command;

@Component
@Command(
    name = "edgechain",
    subcommands = {
      RunCommand.class,
      FormatCommand.class,
      JbangCommand.class,
      CommandLine.HelpCommand.class
    })
public class FlyflyCommand {}
