package com.edgechain.jbang;

import com.edgechain.lib.flyfly.ApplicationRunner;
import org.junit.Test;
import org.junit.jupiter.api.Assertions;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit4.SpringRunner;

@SpringBootTest
@RunWith(SpringRunner.class)
@ActiveProfiles("test")
public class JbangTest {
    @Autowired
    private ApplicationRunner applicationRunner;

    @Test
    public void test() throws Exception {
        Assertions.assertDoesNotThrow(() ->applicationRunner.run("java", "-jar", "edgechain.jar", "jbang wikis"));
    }
}
